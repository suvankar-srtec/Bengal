import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";

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

function wrapPdfText(value: unknown, width: number, fontSize: number, maxLines = 4) {
  const source = ascii(value).trim();
  if (!source) return [""];

  const maxChars = Math.max(4, Math.floor((width - 8) / (fontSize * 0.52)));
  const words = source.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const sourceWord of words) {
    let word = sourceWord;

    while (word.length > maxChars && lines.length < maxLines) {
      if (line) {
        lines.push(line);
        line = "";
        if (lines.length >= maxLines) break;
      }
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }

    if (lines.length >= maxLines) break;

    const candidate = line ? line + " " + word : word;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }

    if (lines.length >= maxLines) break;
  }

  if (lines.length < maxLines && line) lines.push(line);

  if (lines.length === maxLines && source.length > lines.join(" ").length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.slice(0, Math.max(1, last.length - 3)) + "...";
  }

  return lines.length ? lines : [""];
}

type PdfRegistrationRow = {
  cells: string[][];
  height: number;
};

async function buildPdf(event: ExportEvent, registrations: ExportRegistration[]) {
  const sharp = (await import("sharp")).default;
  const logoBase64 = BBC_LOGO_DATA_URL.split(",")[1] ?? "";
  const logoSource = Buffer.from(logoBase64, "base64");
  const logoJpeg = await sharp(logoSource)
    .flatten({ background: "#ffffff" })
    .resize({ width: 360, withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer();

  const logoMetadata = await sharp(logoJpeg).metadata();
  const imagePixelWidth = logoMetadata.width ?? 360;
  const imagePixelHeight = logoMetadata.height ?? 240;

  const PAGE_WIDTH = 842;
  const PAGE_HEIGHT = 595;
  const LEFT = 26;
  const RIGHT = 26;
  const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
  const CORAL = [0.78, 0.30, 0.25] as const;
  const NAVY = [0.09, 0.18, 0.28] as const;
  const MUTED = [0.38, 0.44, 0.48] as const;
  const LINE = [0.87, 0.89, 0.90] as const;
  const LIGHT = [0.97, 0.98, 0.98] as const;
  const WHITE = [1, 1, 1] as const;

  const columns = [
    { label: "Primary member", width: 73 },
    { label: "Participants", width: 98 },
    { label: "Email", width: 106 },
    { label: "WhatsApp", width: 77 },
    { label: "Billing", width: 65 },
    { label: "Meal", width: 43 },
    { label: "Standee", width: 39 },
    { label: "Presentation", width: 53 },
    { label: "Amount", width: 68 },
    { label: "Payment", width: 52 },
    { label: "Registered", width: 69 },
  ];

  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const tableLeft = LEFT + Math.max(0, (CONTENT_WIDTH - tableWidth) / 2);
  const bodyFontSize = 6.4;
  const lineHeight = 8.2;

  const rows: PdfRegistrationRow[] = registrations.map((registration) => {
    const meal = registration.meal_choice
      ? registration.meal_choice[0].toUpperCase() + registration.meal_choice.slice(1)
      : "None";

    const values = [
      registration.member_name,
      (registration.participant_names ?? [registration.member_name]).join(", "),
      registration.email,
      registration.phone,
      registration.billing_details,
      meal,
      String(registration.standee_quantity),
      registration.presentation_selected ? "Yes" : "No",
      "INR " + money(registration.total_paise),
      registration.payment_status
        ? registration.payment_status[0].toUpperCase() + registration.payment_status.slice(1)
        : "",
      dateLabel(registration.created_at),
    ];

    const cells = values.map((value, index) =>
      wrapPdfText(value, columns[index].width, bodyFontSize, index === 1 || index === 2 ? 4 : 3),
    );
    const maxLines = Math.max(...cells.map((cell) => cell.length));

    return {
      cells,
      height: Math.max(26, maxLines * lineHeight + 10),
    };
  });

  function color(value: readonly number[]) {
    return value[0] + " " + value[1] + " " + value[2];
  }

  function rect(
    x: number,
    top: number,
    width: number,
    height: number,
    fill: readonly number[],
    stroke?: readonly number[],
  ) {
    const y = PAGE_HEIGHT - top - height;
    let command =
      color(fill) + " rg " +
      x.toFixed(2) + " " + y.toFixed(2) + " " +
      width.toFixed(2) + " " + height.toFixed(2) + " re f\n";

    if (stroke) {
      command +=
        color(stroke) + " RG 0.5 w " +
        x.toFixed(2) + " " + y.toFixed(2) + " " +
        width.toFixed(2) + " " + height.toFixed(2) + " re S\n";
    }

    return command;
  }

  function line(
    x1: number,
    top1: number,
    x2: number,
    top2: number,
    stroke: readonly number[],
    width = 0.5,
  ) {
    return (
      color(stroke) + " RG " + width + " w " +
      x1.toFixed(2) + " " + (PAGE_HEIGHT - top1).toFixed(2) + " m " +
      x2.toFixed(2) + " " + (PAGE_HEIGHT - top2).toFixed(2) + " l S\n"
    );
  }

  function text(
    value: unknown,
    x: number,
    top: number,
    size: number,
    bold = false,
    fill: readonly number[] = NAVY,
  ) {
    return (
      color(fill) + " rg BT /" + (bold ? "F2" : "F1") + " " + size + " Tf " +
      x.toFixed(2) + " " + (PAGE_HEIGHT - top - size).toFixed(2) +
      " Td (" + pdfEscape(value) + ") Tj ET\n"
    );
  }

  function imageCommand(x: number, top: number, width: number, height: number) {
    const y = PAGE_HEIGHT - top - height;
    return (
      "q " + width.toFixed(2) + " 0 0 " + height.toFixed(2) + " " +
      x.toFixed(2) + " " + y.toFixed(2) + " cm /Im1 Do Q\n"
    );
  }

  function pageHeader(pageNumber: number) {
    let stream = "";
    stream += rect(0, 0, PAGE_WIDTH, 6, CORAL);

    const logoWidth = 112;
    const logoHeight = Math.min(64, logoWidth * imagePixelHeight / imagePixelWidth);
    stream += imageCommand(LEFT, 17, logoWidth, logoHeight);

    const headingX = LEFT + 132;
    stream += text("REGISTRATION REPORT", headingX, 22, 8.5, true, CORAL);
    stream += text(event.title_en, headingX, 36, 19, true, NAVY);
    stream += text(
      dateLabel(event.event_date) + "  |  " + event.organizer,
      headingX,
      62,
      8,
      false,
      MUTED,
    );

    stream += text(
      registrations.length + " registration" + (registrations.length === 1 ? "" : "s"),
      PAGE_WIDTH - RIGHT - 105,
      27,
      8,
      true,
      MUTED,
    );

    stream += line(LEFT, 91, PAGE_WIDTH - RIGHT, 91, LINE, 0.7);

    const headerTop = 103;
    stream += rect(tableLeft, headerTop, tableWidth, 25, NAVY);

    let x = tableLeft;
    columns.forEach((column) => {
      const headerLines = wrapPdfText(column.label.toUpperCase(), column.width, 6.1, 2);
      const totalHeight = headerLines.length * 7;
      const startTop = headerTop + (25 - totalHeight) / 2 + 1;

      headerLines.forEach((headerLine, index) => {
        stream += text(headerLine, x + 4, startTop + index * 7, 6.1, true, WHITE);
      });

      x += column.width;
    });

    return { stream, rowTop: 128, pageNumber };
  }

  const pageStreams: string[] = [];
  let pageIndex = 1;
  let currentPage = pageHeader(pageIndex);
  let currentStream = currentPage.stream;
  let rowTop = currentPage.rowTop;
  let rowIndex = 0;

  function finishPage() {
    currentStream += line(LEFT, PAGE_HEIGHT - 26, PAGE_WIDTH - RIGHT, PAGE_HEIGHT - 26, LINE, 0.5);
    currentStream += text(
      "Bengal Business Council  |  " + event.title_en,
      LEFT,
      PAGE_HEIGHT - 20,
      6.3,
      false,
      MUTED,
    );
    currentStream += text(
      "Page " + pageIndex,
      PAGE_WIDTH - RIGHT - 36,
      PAGE_HEIGHT - 20,
      6.3,
      false,
      MUTED,
    );
    pageStreams.push(currentStream);
  }

  if (!rows.length) {
    currentStream += rect(tableLeft, rowTop, tableWidth, 58, WHITE, LINE);
    currentStream += text(
      "No registrations found for this event.",
      tableLeft + 12,
      rowTop + 21,
      10,
      false,
      MUTED,
    );
  } else {
    for (const row of rows) {
      if (rowTop + row.height > PAGE_HEIGHT - 42) {
        finishPage();
        pageIndex += 1;
        currentPage = pageHeader(pageIndex);
        currentStream = currentPage.stream;
        rowTop = currentPage.rowTop;
      }

      const background = rowIndex % 2 === 0 ? WHITE : LIGHT;
      currentStream += rect(tableLeft, rowTop, tableWidth, row.height, background, LINE);

      let x = tableLeft;
      row.cells.forEach((cellLines, columnIndex) => {
        if (columnIndex > 0) {
          currentStream += line(x, rowTop, x, rowTop + row.height, LINE, 0.35);
        }

        const topPadding = 5;
        cellLines.forEach((cellLine, lineIndex) => {
          const isPrimary = columnIndex === 0;
          let fill: readonly number[] = NAVY;

          if (columnIndex === 9 && cellLine.toLowerCase() === "paid") {
            fill = [0.18, 0.43, 0.33] as const;
          } else if (columnIndex === 9 && cellLine.toLowerCase() === "unpaid") {
            fill = [0.62, 0.39, 0.08] as const;
          }

          currentStream += text(
            cellLine,
            x + 4,
            rowTop + topPadding + lineIndex * lineHeight,
            bodyFontSize,
            isPrimary,
            fill,
          );
        });

        x += columns[columnIndex].width;
      });

      rowTop += row.height;
      rowIndex += 1;
    }
  }

  finishPage();

  const objects = new Map<number, Buffer>();
  const pageReferences: string[] = [];

  objects.set(1, Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"));
  objects.set(3, Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "latin1"));
  objects.set(4, Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>", "latin1"));

  const imageHeader = Buffer.from(
    "<< /Type /XObject /Subtype /Image /Width " + imagePixelWidth +
    " /Height " + imagePixelHeight +
    " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
    logoJpeg.length + " >>\nstream\n",
    "latin1",
  );
  const imageFooter = Buffer.from("\nendstream", "latin1");
  objects.set(5, Buffer.concat([imageHeader, logoJpeg, imageFooter]));

  pageStreams.forEach((stream, index) => {
    const pageObject = 6 + index * 2;
    const contentObject = pageObject + 1;
    pageReferences.push(pageObject + " 0 R");

    objects.set(
      pageObject,
      Buffer.from(
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
        PAGE_WIDTH + " " + PAGE_HEIGHT +
        "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents " +
        contentObject + " 0 R >>",
        "latin1",
      ),
    );

    const contentBuffer = Buffer.from(stream, "latin1");
    objects.set(
      contentObject,
      Buffer.concat([
        Buffer.from("<< /Length " + contentBuffer.length + " >>\nstream\n", "latin1"),
        contentBuffer,
        Buffer.from("endstream", "latin1"),
      ]),
    );
  });

  objects.set(
    2,
    Buffer.from(
      "<< /Type /Pages /Kids [" + pageReferences.join(" ") +
      "] /Count " + pageReferences.length + " >>",
      "latin1",
    ),
  );

  const maxObjectId = Math.max(...objects.keys());
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n", "latin1")];
  const offsets: number[] = new Array(maxObjectId + 1).fill(0);
  let offset = parts[0].length;

  for (let id = 1; id <= maxObjectId; id += 1) {
    const body = objects.get(id);
    if (!body) continue;

    offsets[id] = offset;
    const prefix = Buffer.from(id + " 0 obj\n", "latin1");
    const suffix = Buffer.from("\nendobj\n", "latin1");
    parts.push(prefix, body, suffix);
    offset += prefix.length + body.length + suffix.length;
  }

  const xrefOffset = offset;
  let xref = "xref\n0 " + (maxObjectId + 1) + "\n";
  xref += "0000000000 65535 f \n";

  for (let id = 1; id <= maxObjectId; id += 1) {
    xref += offsets[id]
      ? String(offsets[id]).padStart(10, "0") + " 00000 n \n"
      : "0000000000 00000 f \n";
  }

  xref +=
    "trailer\n<< /Size " + (maxObjectId + 1) +
    " /Root 1 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF";

  parts.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(parts);
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

    const pdf = await buildPdf(event, registrationResult.rows);
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
