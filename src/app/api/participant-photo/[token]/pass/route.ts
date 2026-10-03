import { renderParticipantPass } from "@/lib/participant-pass";
import { participantPhotoRequest } from "@/lib/participant-photo";
import { loadPassRegistration } from "@/lib/whatsapp-delivery";

export const runtime = "nodejs";

const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const photoRequest = await participantPhotoRequest(token, true);
    if (!photoRequest) return new Response(null, { status: 404, headers });
    if (!photoRequest.photo_data) {
      return Response.json({ error: "Upload your photo before downloading the pass." }, { status: 409, headers });
    }

    const registration = await loadPassRegistration(photoRequest.registration_id);
    const index = photoRequest.participant_number - 1;
    if (!registration || !registration.participant_names[index]) {
      return new Response(null, { status: 404, headers });
    }

    const png = await renderParticipantPass(registration, index, photoRequest.photo_data);
    return new Response(new Uint8Array(png), {
      headers: {
        ...headers,
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="${registration.reference}-P${photoRequest.participant_number}.png"`,
      },
    });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
