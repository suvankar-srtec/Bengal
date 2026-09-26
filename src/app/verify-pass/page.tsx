import { notFound } from "next/navigation";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { getDatabase } from "@/lib/db";
import { readPassToken } from "@/lib/pass-token";

export const dynamic = "force-dynamic";

function dateLabel(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function VerifyPassPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const pass = readPassToken(token);
  if (!pass) notFound();

  const result = await getDatabase().query<{
    reference: string;
    event_id: string;
    event_name: string;
    event_date: Date | string;
    participant_names: string[];
    payment_status: string;
    included_meals: string[];
    meal_choice: string | null;
  }>(`
    SELECT reference, event_id, event_name, event_date, participant_names,
      payment_status, included_meals, meal_choice
    FROM public.bbc_event_registrations
    WHERE id = $1
      AND event_id = $2
      AND reference = $3
    LIMIT 1
  `, [pass.registrationId, String(pass.eventId), pass.reference]);

  const registration = result.rows[0];
  const participantName = registration?.participant_names?.[pass.participantNumber - 1];
  if (!registration || !participantName) notFound();

  const meals = registration.included_meals?.length
    ? registration.included_meals
    : registration.meal_choice
      ? [registration.meal_choice]
      : [];

  const valid = registration.payment_status === "paid";

  return <main className="pass-verification-page">
    <section className="pass-verification-card">
      <img src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      <span className={`pass-verification-badge ${valid ? "valid" : "invalid"}`}>
        {valid ? "VALID EVENT PASS" : "PAYMENT NOT COMPLETED"}
      </span>
      <h1>{participantName}</h1>
      <p>{registration.event_name}</p>

      <dl>
        <div><dt>Participant</dt><dd>#{pass.participantNumber}</dd></div>
        <div><dt>Event date</dt><dd>{dateLabel(registration.event_date)}</dd></div>
        <div><dt>Reference</dt><dd>{registration.reference}</dd></div>
        <div><dt>Payment</dt><dd>{valid ? "Paid" : registration.payment_status}</dd></div>
        <div><dt>Meals included</dt><dd>{meals.length ? meals.map((meal) => meal[0].toUpperCase() + meal.slice(1)).join(", ") : "None"}</dd></div>
      </dl>

      <small>This QR contains a secure verification link. No random code needs to be interpreted manually.</small>
    </section>
  </main>;
}
