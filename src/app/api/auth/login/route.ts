import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, adminSessionToken, validAdminCredentials, validManagerPassword } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Use a JSON request." }, { status: 415 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  let sessionToken = "";

  if (validAdminCredentials(username, password)) {
    sessionToken = adminSessionToken({ role: "admin" });
  } else {
    try {
      const result = await getDatabase().query<{
        id: string;
        user_id: string;
        password_hash: string;
        event_id: number;
      }>(
        `SELECT id, user_id, password_hash, event_id
         FROM public.bbc_managers
         WHERE user_id = $1
         LIMIT 1`,
        [username],
      );
      const manager = result.rows[0];

      if (!manager || !validManagerPassword(password, manager.password_hash)) {
        return NextResponse.json({ error: "Invalid user ID or password." }, { status: 401 });
      }

      sessionToken = adminSessionToken({
        role: "manager",
        managerId: manager.id,
        eventId: Number(manager.event_id),
        userId: manager.user_id,
      });
    } catch {
      return NextResponse.json({ error: "Login is temporarily unavailable." }, { status: 503 });
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: sessionToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
