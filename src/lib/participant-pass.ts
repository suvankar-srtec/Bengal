import QRCode from "qrcode";
import sharp from "sharp";
import { BBC_LOGO_DATA_URL } from "./bbc-logo";
import { memberPhotoDataUri } from "./member-photo";
import { mealChoicesLabel, type MealChoice } from "./registration";

export type PassRegistration = {
  id: string;
  reference: string;
  event_id: string;
  event_name: string;
  event_date: string;
  participant_names: string[];
  email: string;
  billing_details: string;
  participation_quantity: number;
  standee_quantity: number;
  meal_choice: MealChoice | null;
  included_meals?: MealChoice[];
  presentation_selected: boolean;
  participation_unit_paise: number;
  standee_unit_paise: number;
  presentation_unit_paise: number;
  meal_unit_paise: number;
};

const GLYPHS: Record<string, string[]> = {
  "A":["01110","10001","10001","11111","10001","10001","10001"],
  "B":["11110","10001","10001","11110","10001","10001","11110"],
  "C":["01111","10000","10000","10000","10000","10000","01111"],
  "D":["11110","10001","10001","10001","10001","10001","11110"],
  "E":["11111","10000","10000","11110","10000","10000","11111"],
  "F":["11111","10000","10000","11110","10000","10000","10000"],
  "G":["01111","10000","10000","10111","10001","10001","01110"],
  "H":["10001","10001","10001","11111","10001","10001","10001"],
  "I":["11111","00100","00100","00100","00100","00100","11111"],
  "J":["00111","00010","00010","00010","10010","10010","01100"],
  "K":["10001","10010","10100","11000","10100","10010","10001"],
  "L":["10000","10000","10000","10000","10000","10000","11111"],
  "M":["10001","11011","10101","10101","10001","10001","10001"],
  "N":["10001","11001","10101","10011","10001","10001","10001"],
  "O":["01110","10001","10001","10001","10001","10001","01110"],
  "P":["11110","10001","10001","11110","10000","10000","10000"],
  "Q":["01110","10001","10001","10001","10101","10010","01101"],
  "R":["11110","10001","10001","11110","10100","10010","10001"],
  "S":["01111","10000","10000","01110","00001","00001","11110"],
  "T":["11111","00100","00100","00100","00100","00100","00100"],
  "U":["10001","10001","10001","10001","10001","10001","01110"],
  "V":["10001","10001","10001","10001","10001","01010","00100"],
  "W":["10001","10001","10001","10101","10101","11011","10001"],
  "X":["10001","10001","01010","00100","01010","10001","10001"],
  "Y":["10001","10001","01010","00100","00100","00100","00100"],
  "Z":["11111","00001","00010","00100","01000","10000","11111"],
  "0":["01110","10001","10011","10101","11001","10001","01110"],
  "1":["00100","01100","00100","00100","00100","00100","01110"],
  "2":["01110","10001","00001","00010","00100","01000","11111"],
  "3":["11110","00001","00001","01110","00001","00001","11110"],
  "4":["00010","00110","01010","10010","11111","00010","00010"],
  "5":["11111","10000","10000","11110","00001","00001","11110"],
  "6":["01110","10000","10000","11110","10001","10001","01110"],
  "7":["11111","00001","00010","00100","01000","01000","01000"],
  "8":["01110","10001","10001","01110","10001","10001","01110"],
  "9":["01110","10001","10001","01111","00001","00001","01110"],
  "@":["01110","10001","10111","10101","10111","10000","01110"],
  ".":["00000","00000","00000","00000","00000","00110","00110"],
  ",":["00000","00000","00000","00000","00000","00110","00010"],
  "-":["00000","00000","00000","11111","00000","00000","00000"],
  "_":["00000","00000","00000","00000","00000","00000","11111"],
  "/":["00001","00010","00010","00100","01000","01000","10000"],
  ":":["00000","00110","00110","00000","00110","00110","00000"],
  "+":["00000","00100","00100","11111","00100","00100","00000"],
  "(":["00010","00100","01000","01000","01000","00100","00010"],
  ")":["01000","00100","00010","00010","00010","00100","01000"],
  "?":["01110","10001","00001","00010","00100","00000","00100"],
  " ":["00000","00000","00000","00000","00000","00000","00000"],
};

function pixelText(text: string, x: number, y: number, scale: number, color = "#182f46", maxChars?: number) {
  const clean = text.toUpperCase().replace(/[^A-Z0-9@.,_\-\/:+()? ]/g, "?");
  const clipped = maxChars && clean.length > maxChars
    ? clean.slice(0, Math.max(1, maxChars - 3)) + "..."
    : clean;
  let path = "";
  [...clipped].forEach((character, charIndex) => {
    const glyph = GLYPHS[character] ?? GLYPHS["?"];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, columnIndex) => {
        if (pixel !== "1") return;
        const px = x + charIndex * 6 * scale + columnIndex * scale;
        const py = y + rowIndex * scale;
        path += `M${px} ${py}h${scale}v${scale}h-${scale}z`;
      });
    });
  });
  return `<path d="${path}" fill="${color}"/>`;
}

function paiseText(value: number) {
  return `INR ${(value / 100).toFixed(2)}`;
}

export function participantPass(registration: PassRegistration, index: number) {
  const participantName = registration.participant_names[index];
  if (!participantName) throw new Error("Participant not found.");

  const participantNumber = index + 1;
  const passId = `${registration.reference}-P${participantNumber}`;
  const mealLabel = mealChoicesLabel(registration.included_meals ?? (registration.meal_choice ? [registration.meal_choice] : []));

  const participationLine = `${paiseText(registration.participation_unit_paise)}/person x ${registration.participation_quantity}`;
  const standeeLine = registration.standee_quantity > 0
    ? `${registration.standee_quantity} x ${paiseText(registration.standee_unit_paise)}`
    : "None";
  const mealLine = registration.included_meals?.length || registration.meal_choice
    ? `${mealLabel} (included in participation fee)`
    : "None";
  const presentationLine = registration.presentation_selected
    ? `Yes (${paiseText(registration.presentation_unit_paise)})`
    : "No";

  return {
    participantName,
    participantNumber,
    passId,
    mealLabel,
    payload: [
      "Bengal Business Council",
      `Participant: ${participantName}`,
      `Participation fees: ${participationLine}`,
      `Standee placement: ${standeeLine}`,
      `Meals included: ${mealLine}`,
      `Company presentation: ${presentationLine}`,
    ].join("\n"),
  };
}

export async function renderParticipantPass(registration: PassRegistration, index: number) {
  const pass = participantPass(registration, index);
  const photoSvg = decodeURIComponent(
    memberPhotoDataUri(pass.participantName.replace(/[<>&"']/g, ""), index + 20).split(",")[1],
  );

  const [qr, logo, photo] = await Promise.all([
    QRCode.toDataURL(pass.payload, { width: 430, margin: 3, errorCorrectionLevel: "M" }),
    sharp(Buffer.from(BBC_LOGO_DATA_URL.split(",")[1], "base64")).png().toBuffer(),
    sharp(Buffer.from(photoSvg)).png().toBuffer(),
  ]);

  const date = new Date(`${registration.event_date}T12:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  // 750 x 1050 keeps the requested 2.5 x 3.5 inch pass ratio.
  // All visible text is rendered as SVG paths, so Vercel does not depend on installed fonts.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1050">
    <rect width="750" height="1050" fill="#ffffff"/>
    <rect width="750" height="14" fill="#c74c40"/>

    ${pixelText("BENGAL BUSINESS COUNCIL", 45, 53, 3, "#182f46", 28)}
    ${pixelText("INDIVIDUAL EVENT PASS", 45, 91, 2.4, "#c74c40", 30)}
    <image href="data:image/png;base64,${logo.toString("base64")}" x="545" y="28" width="160" height="108"/>
    <path d="M45 150H705" stroke="#e5e8ea" stroke-width="2"/>

    ${pixelText(`PARTICIPANT ${pass.participantNumber}`, 45, 184, 2.2, "#626f7b", 28)}
    ${pixelText(pass.participantName, 45, 220, 4, "#182f46", 24)}

    <defs><clipPath id="photo"><circle cx="640" cy="222" r="47"/></clipPath></defs>
    <circle cx="640" cy="222" r="50" fill="#f4edf9"/>
    <image href="data:image/png;base64,${photo.toString("base64")}" x="593" y="175" width="94" height="94" clip-path="url(#photo)"/>

    <rect x="45" y="285" width="660" height="115" rx="8" fill="#f8f9fa"/>
    ${pixelText("EMAIL ADDRESS", 60, 303, 2, "#626f7b", 24)}
    ${pixelText(registration.email, 60, 330, 2.35, "#182f46", 39)}
    ${pixelText("BILLING DETAILS", 60, 365, 2, "#626f7b", 24)}
    ${pixelText(registration.billing_details, 60, 390, 2.45, "#182f46", 28)}

    <rect x="45" y="420" width="660" height="62" rx="8" fill="#fff8f5"/>
    ${pixelText("MEALS INCLUDED", 60, 437, 1.9, "#8a6c64", 24)}
    ${pixelText(pass.mealLabel, 60, 462, 2.7, "#182f46", 24)}

    <image href="data:image/png;base64,${qr.split(",")[1]}" x="160" y="505" width="430" height="430"/>

    ${pixelText("SCAN QR FOR PARTICIPATION DETAILS", 157, 968, 2, "#626f7b", 38)}
    ${pixelText(date, 252, 1008, 1.7, "#626f7b", 28)}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
