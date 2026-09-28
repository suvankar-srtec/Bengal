import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";
import { passImagePath } from "@/lib/whatsapp-delivery";

export const runtime = "nodejs";

const schema = z.object({
  registrationId: z.uuid(),
  participantNumber: z.number().int().min(2).max(20),
  name: z.string().trim().min(2, "Enter the participant name.").max(120),
});

type Row = {
  member_name: string;
  participation_quantity: number;
  participant_names: string[];
  media_token: string;
};

export async function POST(request: Request) {
  const session = readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: "Sign in as an administrator." }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Only administrators can generate imported QR passes." }, { status: 403 });

  let input: z.infer<typeof schema>;
  try { input = schema.parse(await request.json()); }
  catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : "Invalid QR pass request.";
    return Response.json({ error: message || "Invalid QR pass request." }, { status: 400 });
  }

  const database = getDatabase();
  const current = (await database.query<Row>(
    "SELECT r.member_name, r.participation_quantity, r.participant_names, d.media_token " +
    "FROM public.bbc_event_registrations r " +
    "JOIN public.bbc_whatsapp_pass_deliveries d ON d.registration_id = r.id " +
    "WHERE r.id = $1 AND r.payment_status = 'paid' LIMIT 1",
    [input.registrationId],
  )).rows[0];

  if (!current) return Response.json({ error: "Paid registration was not found." }, { status: 404 });
  if (input.participantNumber > current.participation_quantity) {
    return Response.json({ error: "This registration does not contain that QR pass." }, { status: 400 });
  }

  const names = Array.from({ length: current.participation_quantity }, (_, index) =>
    String(current.participant_names?.[index] || "").trim(),
  );
  names[0] = current.member_name;
  names[input.participantNumber - 1] = input.name.trim();

  await database.query(
    "UPDATE public.bbc_event_registrations SET participant_names = $2 WHERE id = $1",
    [input.registrationId, names],
  );

  return Response.json({
    ok: true,
    participantNames: names,
    namesComplete: names.every((name) => Boolean(name)),
    previewUrl: passImagePath(current.media_token, input.participantNumber),
  });
}