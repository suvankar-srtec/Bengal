"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type VenueSelection = { address: string; mapsUrl: string };
let configured = false;

export default function VenueMapPicker({ initialAddress, onSelect, onClose }: {
  initialAddress: string;
  onSelect: (selection: VenueSelection) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<VenueSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    let disposed = false;
    let requestNumber = 0;
    let marker: google.maps.marker.AdvancedMarkerElement | undefined;
    let autocomplete: google.maps.places.PlaceAutocompleteElement | undefined;
    const listeners: google.maps.MapsEventListener[] = [];
    const controller = new AbortController();

    async function initialize() {
      try {
        const { setOptions, importLibrary } = await import("@googlemaps/js-api-loader");
        if (disposed) return;
        if (!configured) {
          setOptions({ key: apiKey, v: "weekly", region: "IN", language: "en" });
          configured = true;
        }
        const [maps, places, geocoding, markers] = await Promise.all([
          importLibrary("maps"), importLibrary("places"), importLibrary("geocoding"), importLibrary("marker"),
        ]);
        if (disposed || !mapRef.current || !searchRef.current) return;
        const map = new maps.Map(mapRef.current, {
          center: { lat: 22.5726, lng: 88.3639 }, zoom: 12,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
          streetViewControl: false, fullscreenControl: false, mapTypeControl: false,
        });
        marker = new markers.AdvancedMarkerElement({ title: "Selected venue" });
        const geocoder = new geocoding.Geocoder();
        autocomplete = new places.PlaceAutocompleteElement({
          placeholder: "Search for your venue or address",
          locationBias: { center: { lat: 22.5726, lng: 88.3639 }, radius: 50000 },
        });
        autocomplete.setAttribute("aria-label", "Search Google Maps for a venue");
        searchRef.current.replaceChildren(autocomplete);

        function applyAddress(address: string, location: google.maps.LatLng, placeId: string | undefined, currentRequest: number) {
          if (disposed || currentRequest !== requestNumber) return;
          if (!address || address.length > 220) throw new Error("invalid_address");
          const params = new URLSearchParams({ api: "1", query: address });
          if (placeId) params.set("query_place_id", placeId);
          setSelection({ address, mapsUrl: `https://www.google.com/maps/search/?${params}` });
          setError("");
          map.panTo(location);
          map.setZoom(17);
          if (marker) { marker.position = location; marker.map = map; }
        }

        async function lookup(request: google.maps.GeocoderRequest) {
          const currentRequest = ++requestNumber;
          setResolving(true);
          setSelection(null);
          setError("");
          try {
            const { results } = await geocoder.geocode(request);
            const result = results[0];
            if (!result) throw new Error("address_not_found");
            applyAddress(result.formatted_address, result.geometry.location, result.place_id, currentRequest);
          } catch {
            if (!disposed && currentRequest === requestNumber) setError("Could not find an address for this location. Search for a venue or choose another point.");
          } finally {
            if (!disposed && currentRequest === requestNumber) setResolving(false);
          }
        }

        autocomplete.addEventListener("gmp-select", async (event) => {
          const currentRequest = ++requestNumber;
          setResolving(true);
          setSelection(null);
          setError("");
          try {
            const place = (event as google.maps.places.PlacePredictionSelectEvent).placePrediction.toPlace();
            await place.fetchFields({ fields: ["formattedAddress", "location", "id"] });
            if (!place.location || !place.formattedAddress) throw new Error("address_not_found");
            applyAddress(place.formattedAddress, place.location, place.id, currentRequest);
          } catch {
            if (!disposed && currentRequest === requestNumber) setError("Could not fetch this venue's address. Please select another result.");
          } finally {
            if (!disposed && currentRequest === requestNumber) setResolving(false);
          }
        }, { signal: controller.signal });
        autocomplete.addEventListener("gmp-error", () => {
          if (!disposed) setError("Google Maps search is unavailable. Please try again later.");
        }, { signal: controller.signal });
        listeners.push(map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (event.latLng) void lookup({ location: event.latLng });
        }));
        setLoading(false);
        if (initialAddress.trim() && initialAddress !== "Venue to be announced") void lookup({ address: initialAddress });
      } catch {
        if (!disposed) {
          setLoading(false);
          setError("Google Maps could not load. Close this window and try again, or enter the address manually.");
        }
      }
    }
    void initialize();
    return () => {
      disposed = true;
      controller.abort();
      listeners.forEach((listener) => listener.remove());
      if (marker) marker.map = null;
      autocomplete?.remove();
    };
  }, [apiKey, initialAddress]);

  return createPortal(<dialog className="venue-picker-dialog" ref={dialogRef} aria-labelledby="venue-picker-title" onCancel={onClose} onClose={onClose}>
    <div className="venue-picker-heading"><div><h2 id="venue-picker-title">Choose venue on Google Maps</h2><p>Search for a venue or click its location on the map.</p></div><button type="button" aria-label="Close venue picker" onClick={onClose}>Close</button></div>
    {!apiKey ? <p className="venue-picker-message" role="status">Google Maps address selection is not configured yet. You can still enter the venue address manually.</p> : <>
      <div ref={searchRef} className="venue-picker-search" />
      {loading && <p role="status">Loading Google Maps...</p>}
      <div ref={mapRef} className="venue-picker-map" aria-label="Venue location map" />
      <div className="venue-picker-selection" aria-live="polite">
        {resolving ? "Fetching address..." : selection ? selection.address : "Select a location to fill the venue address."}
      </div>
      {error && <p role="alert" className="venue-picker-error">{error}</p>}
    </>}
    <div className="venue-picker-actions"><button type="button" onClick={onClose}>Cancel</button><button type="button" disabled={!selection || resolving} onClick={() => selection && onSelect(selection)}>Use this address</button></div>
  </dialog>, document.body);
}
