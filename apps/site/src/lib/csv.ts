/**
 * A small RFC 4180 CSV reader.
 *
 * Testimonials are free text written into a Google Form, which means they
 * routinely contain the three things a `split(",")` cannot survive: commas
 * inside a sentence, quotation marks around a phrase, and hard line breaks
 * from someone pressing Enter in the textarea. Google quotes those fields
 * correctly on export, so the fix is to read the quoting rather than to
 * sanitise the data afterwards.
 *
 * Deliberately not a dependency: the format is small enough that the parser
 * is shorter than the code needed to configure a library, and it runs on the
 * edge where every kilobyte is in the cold-start path.
 */

/** Splits CSV text into rows of raw string cells. Blank trailing rows dropped. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  // Tracks whether the current field began with a quote, so that a comma or
  // newline inside it is treated as content rather than as a delimiter.
  let index = 0;

  // A leading BOM survives Google's export and would otherwise become part of
  // the first header cell, quietly breaking a header lookup.
  if (input.charCodeAt(0) === 0xfeff) index = 1;

  const endField = () => {
    row.push(field);
    field = "";
  };

  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < input.length) {
    const char = input[index];

    if (quoted) {
      if (char === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"' && field === "") {
      quoted = true;
      index += 1;
      continue;
    }

    if (char === ",") {
      endField();
      index += 1;
      continue;
    }

    if (char === "\r") {
      // Normalise CRLF and a lone CR to a single row break.
      if (input[index + 1] === "\n") index += 1;
      endRow();
      index += 1;
      continue;
    }

    if (char === "\n") {
      endRow();
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  // Whatever is still buffered is the final row, unless the file ended on a
  // newline — in which case there is nothing pending and nothing to add.
  if (field !== "" || row.length > 0) endRow();

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}
