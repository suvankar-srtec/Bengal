import assert from "node:assert/strict";
import test from "node:test";
import { isGoogleMapsUrl, venueMapUrl, venueMapEmbedUrl } from "../src/lib/venue-map";
import { DEFAULT_EVENT_CONTENT, eventContentFromRow, eventContentSchema } from "../src/lib/event-content";
import { whatsappPassMessage } from "../src/lib/whatsapp-pass-message";

test("accepts Google Maps share links and rejects unsafe or unrelated URLs", () => {
  for (const url of ["https://maps.app.goo.gl/venue123", "https://www.google.com/maps/place/Kolkata", "https://maps.google.com/?q=Kolkata", "https://goo.gl/maps/venue123", "https://www.google.co.in/maps?q=Kolkata"]) {
    assert.equal(isGoogleMapsUrl(url), true, url);
  }
  for (const url of ["javascript:alert(1)", "http://maps.google.com", "https://maps.app.goo.gl.evil.com/place", "https://google.com.evil.com/maps", "https://www.google.com/search?q=test", "https://example.com/maps", "https://user:password@google.com/maps", "https://google.com:8443/maps", "bad-url"]) {
    assert.equal(isGoogleMapsUrl(url), false, url);
    assert.equal(eventContentSchema.safeParse({ ...DEFAULT_EVENT_CONTENT, googleMapsUrl: url }).success, false);
  }
});

test("existing events get an encoded address link and saved maps take priority", () => {
  const address = "Hall A & B, Salt Lake / Kolkata";
  const result = new URL(venueMapUrl(address)!);
  assert.equal(result.searchParams.get("query"), address);
  assert.equal(result.searchParams.get("api"), "1");
  assert.equal(venueMapUrl(address, " https://maps.app.goo.gl/exactVenue "), "https://maps.app.goo.gl/exactVenue");
  assert.equal(venueMapUrl("Venue to be announced"), null);
  assert.equal(venueMapUrl(""), null);
  assert.equal(eventContentFromRow({ venue: address }).googleMapsUrl, "");
  const { googleMapsUrl: _map, ...legacy } = DEFAULT_EVENT_CONTENT;
  assert.equal(eventContentSchema.parse(legacy).googleMapsUrl, "");
});

test("WhatsApp pass message includes the saved address and map after the pass link", () => {
  const passUrl = "https://example.com/passes/test?v=3";
  const map = "https://maps.app.goo.gl/exactVenue";
  const message = whatsappPassMessage({ memberName: "Test Member", eventName: "October Meetup", participantCount: 2, passUrl, venue: "Venue A, Kolkata", googleMapsUrl: map });
  assert.ok(message.includes("*Venue:* Venue A, Kolkata"));
  assert.ok(message.includes(`Google Maps:\n${map}`));
  assert.ok(message.indexOf(passUrl) < message.indexOf(map));
  assert.ok(message.includes("2 QR passes are ready"));
  assert.ok(!message.includes("Register for Aalap Alochona"));
  assert.ok(!message.includes("29 September 2026"));
  const fallback = whatsappPassMessage({ memberName: "Test", eventName: "Event", participantCount: 1, passUrl, venue: "Kolkata" });
  assert.ok(fallback.includes(venueMapUrl("Kolkata")!));
  assert.ok(fallback.includes("1 QR pass is ready"));
  const noVenue = whatsappPassMessage({ memberName: "Test", eventName: "Event", participantCount: 1, passUrl });
  assert.ok(noVenue.includes("Venue to be announced"));
  assert.ok(!noVenue.includes("Google Maps:"));
});

test("embedded maps use the saved address safely and omit unknown locations", () => {
  const url = new URL(venueMapEmbedUrl("Hall A & B, Kolkata")!);
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.searchParams.get("q"), "Hall A & B, Kolkata");
  assert.equal(url.searchParams.get("output"), "embed");
  assert.equal(new URL(venueMapEmbedUrl("Old address", "https://www.google.com/maps/search/?api=1&query=Selected%20venue")!).searchParams.get("q"), "Selected venue");
  assert.equal(new URL(venueMapEmbedUrl("Kolkata", "https://evil.example/maps?q=Bad")!).searchParams.get("q"), "Kolkata");
  assert.equal(venueMapEmbedUrl("Venue to be announced"), null);
  assert.equal(venueMapEmbedUrl("", "https://maps.app.goo.gl/test"), null);
  assert.equal(new URL(venueMapEmbedUrl("Venue", "https://www.google.com/maps/embed?pb=shared-location")!).searchParams.get("pb"), "shared-location");
});
