import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";
import { buildRegistrationTemplateXlsx } from "@/lib/registration-template-xlsx";

export const runtime = "nodejs";

type EventRow = {
  id: number;
  title_en: string;
  event_date: Date | string;
  participation_unit_paise: number | string;
  standee_unit_paise: number | string;
  presentation_unit_paise: number | string;
};

function dateValue(value: Date | string) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function GET(request: Request) {
  const session = readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: "Sign in as an administrator." }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Only administrators can download the import template." }, { status: 403 });

  const eventId = Number(new URL(request.url).searchParams.get("eventId"));
  if (!Number.isInteger(eventId) || eventId < 1) {
    return Response.json({ error: "Select an event first." }, { status: 400 });
  }

  const event = (await getDatabase().query<EventRow>(
    `SELECT id, title_en, event_date,
      participation_unit_paise, standee_unit_paise, presentation_unit_paise
     FROM public.bbc_event_content
     WHERE id = $1`,
    [eventId],
  )).rows[0];

  if (!event) return Response.json({ error: "The selected event no longer exists." }, { status: 404 });

  const workbook = buildRegistrationTemplateXlsx({
    eventTitle: event.title_en,
    eventDate: dateValue(event.event_date),
    participationRupees: Number(event.participation_unit_paise || 0) / 100,
    standeeRupees: Number(event.standee_unit_paise || 0) / 100,
    presentationRupees: Number(event.presentation_unit_paise || 0) / 100,
  });

  const safeTitle = event.title_en
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "event";

  return new Response(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bbc-${safeTitle}-registration-template.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
