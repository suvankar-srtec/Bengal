import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, hashManagerPassword, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";
import { decryptManagerPassword, encryptManagerPassword, PasswordKeyError } from "@/lib/manager-password";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store", "Pragma": "no-cache" };
function json(body: unknown, status = 200) { return Response.json(body, { status, headers }); }

async function authorize(request: Request) {
  const session = readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return json({ error: "Sign in as an administrator." }, 401);
  if (session.role !== "admin") return json({ error: "Only administrators can manage passwords." }, 403);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Use this website to manage passwords." }, 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "Use this website to manage passwords." }, 403);
}

export async function GET(request: Request, context: Context) {
  const denied = await authorize(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return json({ error: "Invalid manager." }, 400);
  try {
    const manager = (await getDatabase().query<{ password_encrypted: string | null }>(
      "SELECT password_encrypted FROM public.bbc_managers WHERE id = $1", [id])).rows[0];
    if (!manager) return json({ error: "Manager not found." }, 404);
    if (!manager.password_encrypted) return json({ error: "This older password cannot be displayed. Enter and save a new password first." }, 409);
    return json({ password: decryptManagerPassword(manager.password_encrypted, id) });
  } catch (error) {
    return json({ error: error instanceof PasswordKeyError ? error.message : "Password could not be displayed. You can set a new password." }, 503);
  }
}

export async function PATCH(request: Request, context: Context) {
  const denied = await authorize(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return json({ error: "Invalid manager." }, 400);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Use JSON." }, 415);
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 4096) { await reader.cancel(); return json({ error: "Request too large." }, 413); }
      chunks.push(part.value);
    }
    const body = z.object({ password: z.string().min(1).max(128) }).parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const encrypted = encryptManagerPassword(body.password, id);
    const result = await getDatabase().query(`UPDATE public.bbc_managers
      SET password_hash = $2, password_encrypted = $3, updated_at = NOW() WHERE id = $1`,
      [id, hashManagerPassword(body.password), encrypted]);
    if (!result.rowCount) return json({ error: "Manager not found." }, 404);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Enter a password of 1–128 characters." }, 400);
    return json({ error: error instanceof PasswordKeyError ? error.message : "Could not update password. Please retry." }, 503);
  }
}
