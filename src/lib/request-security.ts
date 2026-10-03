import "server-only";

export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    let valid = false;
    try { valid = new URL(origin).host === request.headers.get("host"); } catch { /* Invalid origin. */ }
    if (!valid) throw new RequestError("Use this website to submit your request.", 403);
  }
}
export async function limitedBody(request: Request, limit: number) {
  requireSameOrigin(request);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > limit) { await reader.cancel(); throw new RequestError("The uploaded file or request is too large.", 413); }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks);
}
export async function limitedJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new RequestError("Use a JSON request.", 415);
  try { return JSON.parse((await limitedBody(request, 8192)).toString("utf8")) as unknown; }
  catch (error) { if (error instanceof RequestError) throw error; throw new RequestError("Invalid request."); }
}
export function requestErrorResponse(error: unknown) {
  return Response.json({ error: error instanceof RequestError ? error.message : "The request could not be completed. Please try again." }, {
    status: error instanceof RequestError ? error.status : 503, headers: { "Cache-Control": "no-store" },
  });
}
