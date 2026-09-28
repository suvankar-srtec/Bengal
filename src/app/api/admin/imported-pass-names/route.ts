import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

const batchSchema = z.object({
  registrationId: z.uuid(),
  participantNames: z.array(z.string().trim().min(2).max(120)).min(1).max(20),
});

const singleSchema = z.object({
  registrationId: z.uuid(),
  participantNumber: z.number().int().min(2).max(20),
  participantName: z.string().trim().min(2).max(120),
});

export async function POST(request: Request) {
  const session = readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: "Sign in as an administrator." }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Only administrators can update pass names." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const batch = batchSchema.safeParse(body);
  const single = singleSchema.safeParse(body);
  if (!batch.success && !single.success) {
    return Response.json({ error: "Enter a valid participant name." }, { status: 400 });
  }

  const registrationId = batch.success ? batch.data.registrationId : single.data.registrationId;
  const database = getDatabase();
  const current = (await database.query<{ member_name: string; participation_quantity: number; participant_names: string[] }>(
    "SELECT member_name, participation_quantity, participant_names FROM public.bbc_event_registrations WHERE id = $1 AND payment_status = 'paid' LIMIT 1",
    [registrationId],
  )).rows[0];

  if (!current) return Response.json({ error: "Registration not found." }, { status: 404 });

  let participantNames = Array.from({ length: current.participation_quantity }, (_, index) =>
    current.participant_names?.[index] ?? "",
  );
  participantNames[0] = current.member_name;

  if (single.success) {
    if (single.data.participantNumber > current.participation_quantity) {
      return Response.json({ error: "This QR pass does not exist for the registration." }, { status: 400 });
    }
    participantNames[single.data.participantNumber - 1] = single.data.participantName;
  } else {
    if (batch.data.participantNames.length !== current.participation_quantity) {
      return Response.json({ error: "Enter one name for every QR pass." }, { status: 400 });
    }
    if (batch.data.participantNames[0].trim().toLowerCase() !== current.member_name.trim().toLowerCase()) {
      return Response.json({ error: "The first pass name must match the primary member." }, { status: 400 });
    }
    participantNames = batch.data.participantNames;
  }

  await database.query(
    "UPDATE public.bbc_event_registrations SET participant_names = $2 WHERE id = $1",
    [registrationId, participantNames],
  );

  return Response.json({
    ok: true,
    participantNames,
    complete: participantNames.every((name) => String(name || "").trim().length >= 2),
  });
}
