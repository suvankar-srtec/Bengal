import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  registrationId: z.uuid(),
  phone: z.string().trim().min(8).max(20),
});

function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+") && /^[1-9][0-9]{7,14}$/.test(digits)) {
    return "+" + digits;
  }
  if (/^[6-9][0-9]{9}$/.test(digits)) return "+91" + digits;
  if (/^91[6-9][0-9]{9}$/.test(digits)) return "+" + digits;
  return null;
}

export async function POST(request: Request) {
  const session = readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: "Sign in to update the WhatsApp number." }, { status: 401 });
  if (session.role !== "manager") {
    return Response.json({ error: "Only the assigned manager can update this number here." }, { status: 403 });
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "Enter a valid WhatsApp number." }, { status: 400 });
  }

  const phone = normalizePhone(input.phone);
  if (!phone) {
    return Response.json({ error: "Enter a valid WhatsApp number, for example +919876543210." }, { status: 400 });
  }

  const database = getDatabase();
  const client = await database.connect();

  try {
    await client.query("BEGIN");

    const registration = (await client.query<{ id: string; email: string; event_id: string }>(
      `SELECT id, email, event_id
       FROM public.bbc_event_registrations
       WHERE id = $1
       FOR UPDATE`,
      [input.registrationId],
    )).rows[0];

    if (!registration) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Registration not found." }, { status: 404 });
    }

    if (registration.event_id !== String(session.eventId)) {
      await client.query("ROLLBACK");
      return Response.json({ error: "You can edit numbers only for your assigned event." }, { status: 403 });
    }

    await client.query(
      "UPDATE public.bbc_event_registrations SET phone = $2 WHERE id = $1",
      [input.registrationId, phone],
    );

    await client.query(
      `UPDATE public.bbc_members
       SET phone = $2, updated_at = NOW()
       WHERE email = $1`,
      [registration.email, phone],
    );

    await client.query("COMMIT");
    return Response.json({ ok: true, phone });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Manager phone update failed.", {
      code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined,
    });
    return Response.json({ error: "The WhatsApp number could not be updated. Please retry." }, { status: 500 });
  } finally {
    client.release();
  }
}
