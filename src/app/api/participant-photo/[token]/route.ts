import { after } from "next/server";
import { getDatabase } from "@/lib/db";
import { deliverRegistrationPasses, queueRegistrationPasses } from "@/lib/pass-delivery";
import {
  allParticipantPhotosUploaded,
  saveParticipantPhoto,
} from "@/lib/participant-photo";
import { RequestError, requestErrorResponse, requireSameOrigin } from "@/lib/request-security";

export const runtime = "nodejs";
export const maxDuration = 60;

const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    requireSameOrigin(request);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength && contentLength > 6 * 1024 * 1024) {
      throw new RequestError("Choose a photo up to 5 MB.", 413);
    }

    const { token } = await params;
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) throw new RequestError("Choose a photo first.");

    const saved = await saveParticipantPhoto(token, file);
    const ready = await allParticipantPhotosUploaded(saved.registrationId);

    if (ready) {
      await queueRegistrationPasses(getDatabase(), saved.registrationId);
      after(() => deliverRegistrationPasses(saved.registrationId));
    }

    return Response.json({ ok: true, ready }, { headers });
  } catch (error) {
    const response = requestErrorResponse(error);
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  }
}
