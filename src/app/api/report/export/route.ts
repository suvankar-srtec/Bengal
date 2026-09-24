import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

type ExportEvent = {
  id: number;
  title_en: string;
  event_date: Date | string;
  organizer: string;
};

type ExportRegistration = {
  member_name: string;
  participant_names: string[];
  email: string;
  phone: string;
  billing_details: string;
  meal_choice: "lunch" | "dinner" | null;
  standee_quantity: number;
  presentation_selected: boolean;
  total_paise: number;
  payment_status: string;
  created_at: Date | string;
};

function dateLabel(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function money(paise: number) {
  return (Number(paise || 0) / 100).toFixed(2);
}

function filenamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "event";
}

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function excelXml(event: ExportEvent, registrations: ExportRegistration[]) {
  const headers = [
    "Primary member",
    "Participants",
    "Email",
    "WhatsApp",
    "Billing",
    "Meal",
    "Standee",
    "Presentation",
    "Amount (INR)",
    "Payment",
    "Registered",
  ];

  const rows = registrations.map((registration) => [
    registration.member_name,
    (registration.participant_names ?? [registration.member_name]).join(", "),
    registration.email,
    registration.phone,
    registration.billing_details,
    registration.meal_choice
      ? registration.meal_choice[0].toUpperCase() + registration.meal_choice.slice(1)
      : "None",
    registration.standee_quantity,
    registration.presentation_selected ? "Yes" : "No",
    money(registration.total_paise),
    registration.payment_status,
    dateLabel(registration.created_at),
  ]);

  const cell = (value: unknown, type = "String") =>
    `<Cell><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`;

  const tableRows = [
    `<Row>${cell(event.title_en)}</Row>`,
    `<Row>${cell(`Event date: ${dateLabel(event.event_date)}`)}</Row>`,
    `<Row>${cell(`Organizer: ${event.organizer}`)}</Row>`,
    "<Row></Row>",
    `<Row>${headers.map((header) => cell(header)).join("")}</Row>`,
    ...rows.map((row) => `<Row>${row.map((value) => cell(value)).join("")}</Row>`),
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Registrations">
  <Table>${tableRows}</Table>
 </Worksheet>
</Workbook>`;
}

function ascii(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?");
}

function pdfEscape(value: unknown) {
  return ascii(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(value: unknown, maxLength = 105) {
  const words = ascii(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxLength) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word.length > maxLength ? word.slice(0, maxLength) : word;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function buildPdf(event: ExportEvent, registrations: ExportRegistration[]) {
  const lines: Array<{ text: string; size?: number; bold?: boolean; gapAfter?: number }> = [
    { text: "BENGAL BUSINESS COUNCIL", size: 15, bold: true, gapAfter: 4 },
    { text: `Registration Report - ${event.title_en}`, size: 13, bold: true, gapAfter: 3 },
    { text: `Event date: ${dateLabel(event.event_date)}   Organizer: ${event.organizer}`, size: 8, gapAfter: 8 },
  ];

  if (!registrations.length) {
    lines.push({ text: "No registrations found for this event.", size: 10 });
  }

  registrations.forEach((registration, index) => {
    const participants = (registration.participant_names ?? [registration.member_name]).join(", ");
    const meal = registration.meal_choice
      ? registration.meal_choice[0].toUpperCase() + registration.meal_choice.slice(1)
      : "None";

    lines.push({
      text: `${index + 1}. ${registration.member_name} | Participants: ${participants}`,
      size: 8,
      bold: true,
      gapAfter: 1,
    });

    for (const line of wrapText(
      `Email: ${registration.email} | WhatsApp: ${registration.phone} | Billing: ${registration.billing_details}`,
      118,
    )) {
      lines.push({ text: line, size: 7 });
    }

    lines.push({
      text: `Meal: ${meal} | Standee: ${registration.standee_quantity} | Presentation: ${registration.presentation_selected ? "Yes" : "No"} | Amount: INR ${money(registration.total_paise)} | Payment: ${registration.payment_status} | Registered: ${dateLabel(registration.created_at)}`,
      size: 7,
      gapAfter: 6,
    });
  });

  const pages: string[] = [];
  let current = "";
  let y = 560;

  const addPage = () => {
    if (current) pages.push(current);
    current = "";
    y = 560;
  };

  for (const line of lines) {
    const size = line.size ?? 8;
    const height = Math.max(10, size + 4);
    if (y - height < 30) addPage();

    const font = line.bold ? "F2" : "F1";
    current += `BT /${font} ${size} Tf 28 ${y} Td (${pdfEscape(line.text)}) Tj ET\n`;
    y -= height + (line.gapAfter ?? 0);
  }

  if (current || !pages.length) pages.push(current);

  const objects: string[] = [];
  const pageRefs: string[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  pages.forEach((stream, index) => {
    const pageObject = 5 + index * 2;
    const contentObject = pageObject + 1;
    pageRefs.push(`${pageObject} 0 R`);

    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] =
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`;
  });

  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "latin1");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

export async function GET(request: Request) {
  const store = await cookies();
  if (!validAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventId = Number(url.searchParams.get("eventId"));
  const format = url.searchParams.get("format");

  if (!Number.isInteger(eventId) || eventId < 1) {
    return Response.json({ error: "Invalid event." }, { status: 400 });
  }

  if (format !== "pdf" && format !== "excel") {
    return Response.json({ error: "Invalid export format." }, { status: 400 });
  }

  try {
    const database = getDatabase();

    const eventResult = await database.query<ExportEvent>(
      "SELECT id, title_en, event_date, organizer FROM public.bbc_event_content WHERE id = $1 LIMIT 1",
      [eventId],
    );
    const event = eventResult.rows[0];

    if (!event) {
      return Response.json({ error: "Event not found." }, { status: 404 });
    }

    const registrationResult = await database.query<ExportRegistration>(`
      SELECT
        member_name,
        participant_names,
        email,
        phone,
        billing_details,
        meal_choice,
        standee_quantity,
        presentation_selected,
        total_paise,
        payment_status,
        created_at
      FROM public.bbc_event_registrations
      WHERE event_id = $1
      ORDER BY created_at DESC
    `, [String(eventId)]);

    const baseName = `${filenamePart(event.title_en)}-registrations`;

    if (format === "excel") {
      const xml = excelXml(event, registrationResult.rows);
      return new Response("\uFEFF" + xml, {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.xls"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pdf = buildPdf(event, registrationResult.rows);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const diagnostic = error && typeof error === "object" && "code" in error
      ? String(error.code)
      : undefined;
    console.error("Report export failed.", { code: diagnostic });

    return Response.json({ error: "Couldn’t generate the report download." }, { status: 500 });
  }
}
