import "server-only";

import { inflateRawSync } from "node:zlib";

export type ImportRow = Record<string, string>;

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }

  row.push(value.replace(/\r$/, ""));
  if (row.some((cell) => cell.length) || rows.length === 0) rows.push(row);
  return rows;
}

function findZipEntries(buffer: Buffer) {
  const signature = 0x06054b50;
  let end = -1;
  const minimum = Math.max(0, buffer.length - 65557);

  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error("Invalid Excel file.");

  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const entries = new Map<string, { method: number; compressedSize: number; localOffset: number }>();

  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid Excel archive.");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const filename = buffer.subarray(offset + 46, offset + 46 + filenameLength).toString("utf8");
    entries.set(filename, { method, compressedSize, localOffset });
    offset += 46 + filenameLength + extraLength + commentLength;
  }

  function readEntry(name: string) {
    const entry = entries.get(name);
    if (!entry) return null;
    const local = entry.localOffset;
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error("Invalid Excel archive.");
    const filenameLength = buffer.readUInt16LE(local + 26);
    const extraLength = buffer.readUInt16LE(local + 28);
    const start = local + 30 + filenameLength + extraLength;
    const compressed = buffer.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) return compressed;
    if (entry.method === 8) return inflateRawSync(compressed);
    throw new Error("Unsupported Excel compression.");
  }

  return { readEntry };
}

function spreadsheetColumnIndex(reference: string) {
  const match = reference.match(/^([A-Z]+)/i);
  if (!match) return -1;
  return [...match[1].toUpperCase()].reduce(
    (value, character) => value * 26 + character.charCodeAt(0) - 64,
    0,
  ) - 1;
}

function tagPattern(name: string) {
  return "(?:[A-Za-z_][\\w.-]*:)?" + name;
}

function parseXlsx(buffer: Buffer) {
  const zip = findZipEntries(buffer);
  const si = tagPattern("si");
  const t = tagPattern("t");
  const rowTag = tagPattern("row");
  const cellTag = tagPattern("c");
  const valueTag = tagPattern("v");
  const inlineTag = tagPattern("is");
  const sheetTag = tagPattern("sheet");
  const relationshipTag = tagPattern("Relationship");

  const sharedXml = zip.readEntry("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const sharedStrings = [...sharedXml.matchAll(new RegExp("<" + si + "\\b[^>]*>([\\s\\S]*?)<\\/" + si + ">", "g"))].map((match) =>
    [...match[1].matchAll(new RegExp("<" + t + "\\b[^>]*>([\\s\\S]*?)<\\/" + t + ">", "g"))]
      .map((part) => decodeXml(part[1]))
      .join(""),
  );

  let worksheetPath = "xl/worksheets/sheet1.xml";
  const workbookXml = zip.readEntry("xl/workbook.xml")?.toString("utf8") ?? "";
  const sheetMatch = workbookXml.match(new RegExp("<" + sheetTag + "\\b([^>]*)>", "i"));
  const relationshipId = sheetMatch?.[1].match(/(?:^|\s)(?:[A-Za-z_][\w.-]*:)?id="([^"]+)"/)?.[1];

  if (relationshipId) {
    const relationships = zip.readEntry("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
    for (const match of relationships.matchAll(new RegExp("<" + relationshipTag + "\\b([^>]*)\\/?\\s*>", "g"))) {
      const attributes = match[1];
      const id = attributes.match(/\bId="([^"]+)"/)?.[1];
      const target = attributes.match(/\bTarget="([^"]+)"/)?.[1];
      if (id === relationshipId && target) {
        worksheetPath = target.startsWith("/")
          ? target.slice(1)
          : "xl/" + target.replace(/^\.\//, "");
        break;
      }
    }
  }

  const sheetXml = zip.readEntry(worksheetPath)?.toString("utf8");
  if (!sheetXml) throw new Error("The first Excel worksheet could not be read.");

  const rows: string[][] = [];
  const rowRegex = new RegExp("<" + rowTag + "\\b([^>]*)>([\\s\\S]*?)<\\/" + rowTag + ">", "g");
  const cellRegex = new RegExp("<" + cellTag + "\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)<\\/" + cellTag + ">)", "g");

  for (const rowMatch of sheetXml.matchAll(rowRegex)) {
    const row: string[] = [];
    const rowBody = rowMatch[2];

    for (const cellMatch of rowBody.matchAll(cellRegex)) {
      const attributes = cellMatch[1] ?? "";
      const body = cellMatch[2] ?? "";
      const reference = attributes.match(/\br="([^"]+)"/)?.[1] ?? "";
      const index = spreadsheetColumnIndex(reference);
      if (index < 0) continue;

      const type = attributes.match(/\bt="([^"]+)"/)?.[1] ?? "";
      const raw = body.match(new RegExp("<" + valueTag + ">([\\s\\S]*?)<\\/" + valueTag + ">", "i"))?.[1] ?? "";
      const inlineBlock = body.match(new RegExp("<" + inlineTag + "\\b[^>]*>([\\s\\S]*?)<\\/" + inlineTag + ">", "i"))?.[1] ?? "";
      const inline = [...inlineBlock.matchAll(new RegExp("<" + t + "\\b[^>]*>([\\s\\S]*?)<\\/" + t + ">", "g"))]
        .map((part) => decodeXml(part[1]))
        .join("");

      if (type === "s") row[index] = sharedStrings[Number(raw)] ?? "";
      else if (type === "inlineStr") row[index] = inline;
      else row[index] = decodeXml(raw);
    }

    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function rowsToObjects(rows: string[][]): ImportRow[] {
  const firstNonEmpty = rows.findIndex((row) => row.some((cell) => String(cell ?? "").trim()));
  if (firstNonEmpty < 0) return [];

  const headers = rows[firstNonEmpty].map((cell) => normalizeHeader(String(cell ?? "")));
  if (!headers.some(Boolean)) throw new Error("The file does not contain a header row.");

  const result: ImportRow[] = [];
  for (let index = firstNonEmpty + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const hasData = row.some((cell) => String(cell ?? "").trim());

    // The import table is expected to be contiguous. Stop at the first blank row
    // so notes or instructions below the table are not treated as registrations.
    if (!hasData) break;

    result.push(Object.fromEntries(
      headers
        .map((header, columnIndex) => [header, String(row[columnIndex] ?? "").trim()] as const)
        .filter(([header]) => Boolean(header)),
    ));
  }

  return result;
}

export function parseRegistrationImport(filename: string, buffer: Buffer) {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".csv")) {
    return rowsToObjects(parseCsv(buffer.toString("utf8").replace(/^\uFEFF/, "")));
  }

  if (lower.endsWith(".xlsx")) {
    return rowsToObjects(parseXlsx(buffer));
  }

  throw new Error("Upload a .csv or .xlsx file.");
}
