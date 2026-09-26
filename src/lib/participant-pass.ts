import QRCode from "qrcode";
import sharp from "sharp";
import { BBC_LOGO_DATA_URL } from "./bbc-logo";
import { memberPhotoDataUri } from "./member-photo";
import { mealChoiceLabel, type MealChoice } from "./registration";

export type PassRegistration = {
  id: string;
  reference: string;
  event_id: string;
  event_name: string;
  event_date: string;
  participant_names: string[];
  meal_choice: MealChoice | null;
};

export function participantPass(registration: PassRegistration, index: number) {
  const participantName = registration.participant_names[index];
  if (!participantName) throw new Error("Participant not found.");
  const participantNumber = index + 1;
  const passId = `${registration.reference}-P${participantNumber}`;
  return {
    participantName,
    participantNumber,
    passId,
    mealLabel: registration.meal_choice ? mealChoiceLabel(registration.meal_choice) : "No meal",
    payload: `BBC|EVENT:${encodeURIComponent(registration.event_id)}|REG:${registration.id}|REF:${registration.reference}|PARTICIPANT:${participantNumber}|PASS:${passId}|NAME:${encodeURIComponent(participantName)}|MEAL:${registration.meal_choice ?? "none"}`,
  };
}

function xml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}

export async function renderParticipantPass(registration: PassRegistration, index: number) {
  const pass = participantPass(registration, index);
  const photoSvg = decodeURIComponent(memberPhotoDataUri(pass.participantName.replace(/[<>&"']/g, ""), index + 20).split(",")[1]);
  const [qr, logo, photo] = await Promise.all([
    QRCode.toDataURL(pass.payload, { width: 480, margin: 4, errorCorrectionLevel: "M" }),
    sharp(Buffer.from(BBC_LOGO_DATA_URL.split(",")[1], "base64")).png().toBuffer(),
    sharp(Buffer.from(photoSvg)).png().toBuffer(),
  ]);
  const date = new Date(`${registration.event_date}T12:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  // Render one image for both browser downloads and WhatsApp, using stored details.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1050">
    <rect width="750" height="1050" fill="white"/><rect width="750" height="14" fill="#c74c40"/>
    <g font-family="Arial, sans-serif" fill="#182f46">
      <text x="45" y="72" font-size="22" font-weight="700">BENGAL BUSINESS COUNCIL</text>
      <text x="45" y="108" font-size="15" fill="#c74c40">INDIVIDUAL EVENT PASS</text>
      <image href="data:image/png;base64,${logo.toString("base64")}" x="535" y="30" width="175" height="118"/>
      <path d="M45 155H705" stroke="#e5e8ea" stroke-width="2"/>
      <text x="45" y="198" font-size="14" fill="#626f7b">PARTICIPANT ${pass.participantNumber}</text>
      <text x="45" y="246" font-size="${pass.participantName.length > 30 ? 22 : 34}" font-weight="700" textLength="${Math.min(520, pass.participantName.length * 19)}" lengthAdjust="spacingAndGlyphs">${xml(pass.participantName)}</text>
      <defs><clipPath id="photo"><circle cx="635" cy="220" r="46"/></clipPath></defs>
      <image href="data:image/png;base64,${photo.toString("base64")}" x="589" y="174" width="92" height="92" clip-path="url(#photo)"/>
      <rect x="45" y="275" width="660" height="64" fill="#f8f9fa"/>
      <text x="60" y="297" font-size="12" fill="#626f7b">MEAL PREFERENCE</text>
      <text x="60" y="325" font-size="22" font-weight="700">${xml(pass.mealLabel)}</text>
      <image href="data:image/png;base64,${qr.split(",")[1]}" x="135" y="374" width="480" height="480"/>
      <g text-anchor="middle">
        <text x="375" y="880" font-size="12" fill="#626f7b">SCAN THIS PASS AT ENTRY</text>
        <text x="375" y="913" font-size="15" font-family="monospace">${xml(pass.passId)}</text>
        <text x="375" y="948" font-size="18">${xml(registration.event_name.slice(0, 65))}</text>
        <text x="375" y="977" font-size="14" fill="#626f7b">${xml(date)}</text>
        <text x="375" y="1012" font-size="11" fill="#c74c40">INDIVIDUAL PASS Â· NON-TRANSFERABLE</text>
      </g>
    </g>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
