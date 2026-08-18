import { deflateSync, inflateSync } from "node:zlib";

/**
 * Recolour an 8-bit RGBA PNG to a flat colour, keeping its alpha as the shape.
 *
 * The mark in `packages/cli/logo.png` is orange, which is invisible on the
 * orange OG card. Rather than commit a second logo file — the whole point of
 * brand.ts reading one source is that the generated images cannot drift from
 * it — the white variant is derived from those same bytes at build time.
 *
 * Hand-rolled rather than `sharp`: sharp is only present here as a transitive
 * dependency of Next, and taking a build-time dependency on someone else's
 * dependency is how builds break on an unrelated upgrade. `node:zlib` is
 * enough — this is one filter pass over ~430k pixels, a few milliseconds.
 *
 * Only ever called during `next build`, for the same reason as logoDataUri():
 * the Worker has no filesystem and Satori needs the bytes inline.
 */

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function buildCrcTable(): Int32Array {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
}

const crcTable = buildCrcTable();

function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/** The one PNG filter that needs more than the byte to its left and above. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Returns the PNG re-encoded with every pixel set to `rgb`, alpha untouched.
 * Throws if the input is not the 8-bit non-interlaced RGBA that logo.png is —
 * a silent wrong-colour card is worse than a failed build.
 */
export function tintPng(src: Buffer, rgb: [number, number, number]): Buffer {
  let offset = 8;
  let width = 0;
  let height = 0;
  const parts: Buffer[] = [];

  while (offset < src.length) {
    const length = src.readUInt32BE(offset);
    const type = src.toString("ascii", offset + 4, offset + 8);
    const data = src.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      const interlace = data[12];
      if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
        throw new Error(
          `tintPng expects 8-bit non-interlaced RGBA, got bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`,
        );
      }
    } else if (type === "IDAT") {
      parts.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  // Undo the per-scanline filters into flat RGBA.
  const raw = inflateSync(Buffer.concat(parts));
  const bpp = 4;
  const stride = width * bpp;
  const pixels = Buffer.alloc(height * stride);
  let read = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[read++]!;
    const row = raw.subarray(read, read + stride);
    read += stride;

    const current = pixels.subarray(y * stride, (y + 1) * stride);
    const previous = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? current[x - bpp]! : 0;
      const up = previous ? previous[x]! : 0;
      const upLeft = previous && x >= bpp ? previous[x - bpp]! : 0;
      let value = row[x]!;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      current[x] = value & 0xff;
    }
  }

  const [r, g, b] = rgb;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
  }

  // Re-emit with filter 0 on every row: the shape is now flat colour, so the
  // predictors have nothing left to predict and zlib handles the runs.
  const filtered = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0;
    pixels.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(filtered, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
