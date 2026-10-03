import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { participantPhotoRequest } from "@/lib/participant-photo";
import { ParticipantPhotoUploader } from "@/components/participant-photo-uploader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add Your Photo | Bengal Business Council",
  robots: { index: false, follow: false },
};

export default async function ParticipantPhotoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const request = await participantPhotoRequest(token);
  if (!request) notFound();

  const date = new Date(`${request.event_date}T12:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="participant-photo-page">
      <header className="participant-photo-header">
        <img src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
        <div>
          <span>PAYMENT CONFIRMED</span>
          <h2>{request.event_name}</h2>
          <p>{date}</p>
        </div>
      </header>

      <ParticipantPhotoUploader
        token={token}
        participantName={request.participant_name}
        alreadyUploaded={Boolean(request.photo_uploaded_at)}
      />

      <p className="participant-photo-security">
        This private link is intended only for the named participant. Do not forward it.
      </p>
    </main>
  );
}
