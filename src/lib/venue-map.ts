export function isGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    if (host === "maps.app.goo.gl") return url.pathname.length > 1;
    if (host === "goo.gl") return url.pathname.startsWith("/maps/");
    if (host === "maps.google.com" || host === "maps.google.co.in") return true;
    return ["google.com", "www.google.com", "google.co.in", "www.google.co.in"].includes(host)
      && /^\/maps(?:\/|$)/.test(url.pathname);
  } catch {
    return false;
  }
}

export function venueMapUrl(venue: string | null | undefined, savedUrl?: string | null) {
  const saved = savedUrl?.trim();
  if (saved && isGoogleMapsUrl(saved)) return saved;
  const address = venue?.trim();
  if (!address || address.toLowerCase() === "venue to be announced") return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function venueMapEmbedUrl(venue: string | null | undefined, savedUrl?: string | null) {
  const mapUrl = venueMapUrl(venue, savedUrl);
  if (!mapUrl) return null;
  const saved = new URL(mapUrl);
  // Preserve Google Maps' shared embed locations when supplied.
  if (saved.pathname === "/maps/embed" && saved.searchParams.has("pb")) {
    return `https://www.google.com/maps/embed?${new URLSearchParams({ pb: saved.searchParams.get("pb")! })}`;
  }
  const address = venue?.trim();
  const query = saved.searchParams.get("query") || saved.searchParams.get("q")
    || (address && address.toLowerCase() !== "venue to be announced" ? address : null);
  if (!query) return null;
  return `https://www.google.com/maps?${new URLSearchParams({ q: query, output: "embed", z: "16" })}`;
}
