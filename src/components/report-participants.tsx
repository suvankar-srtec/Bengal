import type { ParticipantContact } from "@/lib/registration";

export function ReportParticipants({ names, contacts }: { names: string[]; contacts: ParticipantContact[] }) {
  return <div className="report-participant-names">
    {names.map((name, index) => {
      const contact = index > 0 ? contacts[index - 1] : undefined;
      return <div key={index}>
        <span>{name}</span>
        {contact && <details className="participant-contact-details">
          <summary>Contact details</summary>
          <a href={`tel:${contact.phone}`}>{contact.phone}</a>
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
        </details>}
      </div>;
    })}
  </div>;
}
