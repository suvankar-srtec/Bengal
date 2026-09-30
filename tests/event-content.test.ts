import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_EVENT_CONTENT, eventAboutSections, eventContentFromRow, eventContentSchema, MAX_ABOUT_SECTIONS } from "../src/lib/event-content";

test("legacy event rows keep their first two paragraph sections", () => {
  const content = eventContentFromRow({ tagline_line_1: "First", about_paragraph_1: "First paragraph", tagline_line_2: "Second", about_paragraph_2: "Second paragraph" });
  assert.deepEqual(content.additionalAboutSections, []);
  assert.deepEqual(eventAboutSections(content).map((section) => section.tagline), ["First", "Second"]);
});

test("saved extra sections retain their order and blank sections are omitted", () => {
  const content = eventContentFromRow({ tagline_line_1: "First", about_paragraph_1: "First paragraph", tagline_line_2: "Second", about_paragraph_2: "Second paragraph", additional_about_sections: [{ tagline: " Third ", paragraph: " Third paragraph " }, { tagline: "", paragraph: "" }, { tagline: "Fourth", paragraph: "Fourth paragraph" }] });
  assert.deepEqual(eventAboutSections(content).map((section) => section.tagline), ["First", "Second", "Third", "Fourth"]);
  assert.equal(content.additionalAboutSections[0].paragraph, "Third paragraph");
});

test("event input accepts older clients and bounds extra section content", () => {
  const { additionalAboutSections: _extra, ...legacy } = DEFAULT_EVENT_CONTENT;
  assert.deepEqual(eventContentSchema.parse(legacy).additionalAboutSections, []);
  assert.equal(eventContentSchema.safeParse({ ...legacy, additionalAboutSections: [{ tagline: "x".repeat(221), paragraph: "Text" }] }).success, false);
  assert.equal(eventContentSchema.safeParse({ ...legacy, additionalAboutSections: [{ tagline: "Heading", paragraph: "x".repeat(1501) }] }).success, false);
  assert.equal(eventContentSchema.safeParse({ ...legacy, additionalAboutSections: Array.from({ length: MAX_ABOUT_SECTIONS - 2 }, () => ({ tagline: "Heading", paragraph: "Text" })) }).success, true);
  assert.equal(eventContentSchema.safeParse({ ...legacy, additionalAboutSections: Array.from({ length: MAX_ABOUT_SECTIONS - 1 }, () => ({ tagline: "Heading", paragraph: "Text" })) }).success, false);
});
