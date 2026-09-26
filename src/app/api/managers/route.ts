import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, hashManagerPassword, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

async function requireAdmin() {
  const store = await cookies();
  return readAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)?.role === "admin";
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: { userId?: unknown; password?: unknown; eventId?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const eventId = Number(body.eventId);

  if (!/^[A-Za-z0-9._-]{3,80}$/.test(userId)) {
    return NextResponse.json({ error: "User ID must be 3–80 characters using letters, numbers, dot, underscore or hyphen." }, { status: 400 });
  }
  if (password.length < 6 || password.length > 128) {
    return NextResponse.json({ error: "Password must be between 6 and 128 characters." }, { status: 400 });
  }
  if (!Number.isInteger(eventId) || eventId < 1) {
    return NextResponse.json({ error: "Select an event." }, { status: 400 });
  }

  try {
    const database = getDatabase();
    const event = await database.query("SELECT id FROM public.bbc_event_content WHERE id = $1", [eventId]);
    if (!event.rowCount) return NextResponse.json({ error: "Selected event no longer exists." }, { status: 404 });

    await database.query(
      `INSERT INTO public.bbc_managers (id, user_id, password_hash, event_id)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, hashManagerPassword(password), eventId],
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "23505") return NextResponse.json({ error: "That User ID is already in use." }, { status: 409 });
    return NextResponse.json({ error: "Couldn’t create manager." }, { status: 500 });
  }
}
