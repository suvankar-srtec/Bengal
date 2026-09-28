import "server-only";

import { deflateRawSync } from "node:zlib";

type TemplatePricing = {
  eventTitle: string;
  eventDate: string;
  participationRupees: number;
  standeeRupees: number;
  presentationRupees: number;
};

type ZipEntry = { name: string; data: Buffer };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: ZipEntry[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralDirectory, end]);
}

function xml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineCell(ref: string, value: string, style: number) {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
}

function blankCell(ref: string, style: number) {
  return `<c r="${ref}" s="${style}"/>`;
}

function numberCell(ref: string, value: number, style = 0) {
  return `<c r="${ref}" s="${style}"><v>${Number.isFinite(value) ? value : 0}</v></c>`;
}

function formulaCell(ref: string, formula: string, style: number) {
  return `<c r="${ref}" s="${style}"><f>${xml(formula)}</f><v></v></c>`;
}

function sheetPasswordHash(password: string) {
  let hash = 0;
  for (let index = password.length - 1; index >= 0; index -= 1) {
    hash = ((hash >> 14) & 0x01) | ((hash << 1) & 0x7fff);
    hash ^= password.charCodeAt(index);
  }
  hash ^= password.length;
  hash ^= 0xce4b;
  return hash.toString(16).toUpperCase().padStart(4, "0");
}

function registrationsSheet() {
  const headers = [
    "Primary Member",
    "Additional Participants",
    "Email",
    "WhatsApp Number",
    "Billing Details",
    "Participation Fees",
    "Standee Quantity",
    "Company Presentation",
    "Amount Paid",
  ];

  const headerCells = headers.map((header, index) =>
    inlineCell(String.fromCharCode(65 + index) + "1", header, 1),
  ).join("");

  const rows: string[] = [`<row r="1" ht="24" customHeight="1">${headerCells}</row>`];

  for (let row = 2; row <= 501; row += 1) {
    const participationFormula =
      `IF(A${row}="","",_Pricing!$B$1*(1+IF(B${row}="",0,LEN(B${row})-LEN(SUBSTITUTE(B${row},"|",""))+1)))`;
    const amountFormula =
      `IF(A${row}="","",F${row}+IF(G${row}="",0,G${row})*_Pricing!$B$2+IF(LOWER(H${row})="yes",_Pricing!$B$3,0))`;

    rows.push(
      `<row r="${row}">` +
      blankCell(`A${row}`, 2) +
      blankCell(`B${row}`, 2) +
      blankCell(`C${row}`, 2) +
      blankCell(`D${row}`, 2) +
      blankCell(`E${row}`, 2) +
      formulaCell(`F${row}`, participationFormula, 3) +
      blankCell(`G${row}`, 4) +
      blankCell(`H${row}`, 2) +
      formulaCell(`I${row}`, amountFormula, 3) +
      `</row>`,
    );
  }

  const password = sheetPasswordHash("BBC2026");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft" activeCell="A2" sqref="A2"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="22" customWidth="1"/>
    <col min="2" max="2" width="32" customWidth="1"/>
    <col min="3" max="3" width="30" customWidth="1"/>
    <col min="4" max="4" width="20" customWidth="1"/>
    <col min="5" max="5" width="20" customWidth="1"/>
    <col min="6" max="6" width="20" customWidth="1"/>
    <col min="7" max="7" width="18" customWidth="1"/>
    <col min="8" max="8" width="22" customWidth="1"/>
    <col min="9" max="9" width="18" customWidth="1"/>
  </cols>
  <sheetData>${rows.join("")}</sheetData>
  <sheetProtection password="${password}" sheet="1" objects="1" scenarios="1" formatCells="1" formatColumns="1" formatRows="1" insertColumns="1" insertRows="1" deleteColumns="1" deleteRows="1"/>
  <dataValidations count="1">
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Invalid value" error="Choose Yes or No." sqref="H2:H501">
      <formula1>"Yes,No"</formula1>
    </dataValidation>
  </dataValidations>
</worksheet>`;
}

function pricingSheet(pricing: TemplatePricing) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">${inlineCell("A1", "Participation fee per person", 0)}${numberCell("B1", pricing.participationRupees, 5)}</row>
    <row r="2">${inlineCell("A2", "Standee fee", 0)}${numberCell("B2", pricing.standeeRupees, 5)}</row>
    <row r="3">${inlineCell("A3", "Company presentation fee", 0)}${numberCell("B3", pricing.presentationRupees, 5)}</row>
    <row r="4">${inlineCell("A4", "Event", 0)}${inlineCell("B4", pricing.eventTitle, 0)}</row>
    <row r="5">${inlineCell("A5", "Event date", 0)}${inlineCell("B5", pricing.eventDate, 0)}</row>
  </sheetData>
  <sheetProtection password="${sheetPasswordHash("BBC2026")}" sheet="1" objects="1" scenarios="1"/>
</worksheet>`;
}

export function buildRegistrationTemplateXlsx(pricing: TemplatePricing) {
  const files: ZipEntry[] = [
    {
      name: "[Content_Types].xml",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    {
      name: "xl/workbook.xml",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Registrations" sheetId="1" r:id="rId1"/>
    <sheet name="_Pricing" sheetId="2" state="hidden" r:id="rId2"/>
  </sheets>
  <calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>`),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    },
    {
      name: "xl/styles.xml",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="&#8377;#,##0.00"/></numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFC94C3D"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD9E1E5"/></left>
      <right style="thin"><color rgb="FFD9E1E5"/></right>
      <top style="thin"><color rgb="FFD9E1E5"/></top>
      <bottom style="thin"><color rgb="FFD9E1E5"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyProtection="1"><protection locked="0"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyProtection="1"><protection locked="0"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`),
    },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(registrationsSheet()) },
    { name: "xl/worksheets/sheet2.xml", data: Buffer.from(pricingSheet(pricing)) },
  ];

  return zip(files);
}
