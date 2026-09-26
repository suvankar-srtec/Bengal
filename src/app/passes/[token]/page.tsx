import { notFound } from "next/navigation";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { getDatabase } from "@/lib/db";
import { participantPass } from "@/lib/participant-pass";
import { loadPassRegistration, passImagePath } from "@/lib/whatsapp-delivery";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your Event Passes | Bengal Business Council",
  robots: { index: false, follow: false },
};

export default async function PassBundlePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();

  const delivery = (
    await getDatabase().query<{ registration_id: string }>(
      `SELECT registration_id
       FROM public.bbc_whatsapp_pass_deliveries
       WHERE media_token = $1
         AND media_expires_at > NOW()`,
      [token],
    )
  ).rows[0];

  if (!delivery) notFound();

  const registration = await loadPassRegistration(delivery.registration_id);
  if (!registration) notFound();

  const passes = registration.participant_names.map((_, index) => {
    const { payload: _payload, ...pass } = participantPass(registration, index);
    return {
      ...pass,
      imageUrl: passImagePath(token, index + 1),
    };
  });

  const eventDate = new Date(`${registration.event_date}T12:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="public-pass-page">
      <header className="public-pass-header">
        <img src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
        <div>
          <span>PAYMENT CONFIRMED</span>
          <h1>Your event passes</h1>
          <p>{registration.event_name} · {eventDate}</p>
        </div>
      </header>

      <section className="public-pass-summary">
        <div>
          <span>Primary member</span>
          <strong>{registration.participant_names[0]}</strong>
        </div>
        <div>
          <span>Number of passes</span>
          <strong>{passes.length}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong className="paid-label">Paid</strong>
        </div>
      </section>

      <section className="public-pass-list">
        {passes.map((pass) => (
          <article className="public-pass-card" key={pass.passId}>
            <div className="public-pass-card-heading">
              <span>Participant {pass.participantNumber}</span>
              <h2>{pass.participantName}</h2>
              <p>Meal: {pass.mealLabel}</p>
            </div>

            <img src={pass.imageUrl} alt={`QR event pass for ${pass.participantName}`} />

            <a href={pass.imageUrl} download={`${pass.passId}.png`}>
              Download pass
            </a>
          </article>
        ))}
      </section>

      <p className="public-pass-security">
        This private link is valid for a limited period. Anyone with the link can view these passes.
      </p>
    </main>
  );
}
