import { HTTPException } from "hono/http-exception";

/** Fail a request with a JSON body the dashboard knows how to render. */
export function fail(status: 400 | 404 | 409 | 500 | 501 | 503, message: string, detail?: string): never {
  throw new HTTPException(status, {
    res: Response.json({ error: message, ...(detail ? { detail } : {}) }, { status }),
  });
}

