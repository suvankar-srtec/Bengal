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
  if (session.role !== "admin") {
    return Response.json({ error: "Only administrators can update pass names." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const singleResult = singleSchema.safeParse(body);
  const batchResult = batchSchema.safeParse(body);

  let registrationId: string;
  let singleInput: z.infer<typeof singleSchema> | null = null;
  let batchInput: z.infer<typeof batchSchema> | null = null;

  if (singleResult.success) {
    singleInput = singleResult.data;
    registrationId = singleInput.registrationId;
  } else if (batchResult.success) {
    batchInput = batchResult.data;
    registrationId = batchInput.registrationId;
  } else {
    return Response.json({ error: "Enter a valid participant name." }, { status: 400 });
  }

  const database = getDatabase();
  const current = (
    await database.query<{
      member_name: string;
      participation_quantity: number;
      participant_names: string[];
    }>(
      "SELECT member_name, participation_quantity, participant_names FROM public.bbc_event_registrations WHERE id = $1 AND payment_status = 'paid' LIMIT 1",
      [registrationId],
    )
  ).rows[0];

  if (!current) {
    return Response.json({ error: "Registration not found." }, { status: 404 });
  }

  let participantNames = Array.from(
    { length: current.participation_quantity },
    (_, index) => current.participant_names?.[index] ?? "",
  );
  participantNames[0] = current.member_name;

  if (singleInput) {
    if (singleInput.participantNumber > current.participation_quantity) {
      return Response.json(
        { error: "This QR pass does not exist for the registration." },
        { status: 400 },
      );
    }

    participantNames[singleInput.participantNumber - 1] = singleInput.participantName;
  } else if (batchInput) {
    if (batchInput.participantNames.length !== current.participation_quantity) {
      return Response.json(
        { error: "Enter one name for every QR pass." },
        { status: 400 },
      );
    }

    if (
      batchInput.participantNames[0].trim().toLowerCase() !==
      current.member_name.trim().toLowerCase()
    ) {
      return Response.json(
        { error: "The first pass name must match the primary member." },
        { status: 400 },
      );
    }

    participantNames = batchInput.participantNames;
  }

  await database.query(
    "UPDATE public.bbc_event_registrations SET participant_names = $2 WHERE id = $1",
    [registrationId, participantNames],
  );

  return Response.json({
    ok: true,
    participantNames,
    complete: participantNames.every(
      (name) => String(name || "").trim().length >= 2,
    ),
  });
}
