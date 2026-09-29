"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { venueMapUrl } from "@/lib/venue-map";

const VenueMapPicker = dynamic(() => import("./venue-map-picker"), { ssr: false });

export function VenueAddressField({ address, mapsUrl, onChange }: {
  address: string;
  mapsUrl: string;
  onChange: (address: string, mapsUrl: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const mapUrl = venueMapUrl(address, mapsUrl);
  return <div className="venue-address-field">
    <label htmlFor="venue-address">Venue address</label>
    <div className="venue-address-input">
      <input id="venue-address" value={address} onChange={(event) => onChange(event.target.value, "")} maxLength={220} required placeholder="Choose the venue using the map icon" />
      <button type="button" aria-label="Choose venue on Google Maps" title="Choose venue on Google Maps" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z" stroke="#4285f4" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 3v16m6-14v16" stroke="#34a853" strokeWidth="1.4" />
          <path d="M12 4a4 4 0 0 0-4 4c0 3 4 7 4 7s4-4 4-7a4 4 0 0 0-4-4Z" fill="#ea4335" stroke="white" />
          <circle cx="12" cy="8" r="1.4" fill="white" />
        </svg>
      </button>
    </div>
    {mapUrl && <a className="venue-map-link" href={mapUrl} target="_blank" rel="noopener noreferrer">View venue on Google Maps</a>}
    {open && <VenueMapPicker initialAddress={address} onSelect={(selection) => {
      onChange(selection.address, selection.mapsUrl);
      setOpen(false);
    }} onClose={() => setOpen(false)} />}
  </div>;
}
