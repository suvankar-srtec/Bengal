import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  registrationId: z.uuid(),
  participantNames: z.array(z.string().trim().min(2).max(120)).min(1).max(20),
});

export async function POST(request: Request) {
  const session = readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: "Sign in as an administrator." }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Only administrators can update pass names." }, { status: 403 });

  let input: z.infer<typeof schema>;
  try { input = schema.parse(await request.json()); }
  catch { return Response.json({ error: "Enter a valid name for every QR pass." }, { status: 400 }); }

  const database = getDatabase();
  const current = (await database.query<{ member_name: string; participation_quantity: number }>(
    "SELECT member_name, participation_quantity FROM public.bbc_event_registrations WHERE id = $1 AND payment_status = 'paid' LIMIT 1",
    [input.registrationId],
  )).rows[0];

  if (!current) return Response.json({ error: "Registration not found." }, { status: 404 });
  if (input.participantNames.length !== current.participation_quantity) {
    return Response.json({ error: "Enter one name for every QR pass." }, { status: 400 });
  }
  if (input.participantNames[0].trim().toLowerCase() !== current.member_name.trim().toLowerCase()) {
    return Response.json({ error: "The first pass name must match the primary member." }, { status: 400 });
  }

  await database.query(
    "UPDATE public.bbc_event_registrations SET participant_names = $2 WHERE id = $1",
    [input.registrationId, input.participantNames],
  );

  return Response.json({ ok: true, participantNames: input.participantNames });
}