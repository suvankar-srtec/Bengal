import assert from "node:assert/strict";
import test from "node:test";
import { calculateTotal, registrationSchema } from "../src/lib/registration";

const valid = {
  submissionId: "b582b911-bf74-46fc-a8c1-6c757f18a3d2",
  memberName: "Test Member", email: "member@example.com", phone: "9000000000", billingDetails: "ABCDE1234F",
  participationQuantity: 1, standeeQuantity: 0, presentationSelected: false,
};

test("calculates base registration and all add-ons in integer paise", () => {
  assert.equal(calculateTotal(valid), 118000);
  assert.equal(calculateTotal({ participationQuantity: 2, standeeQuantity: 1, presentationSelected: true }), 4071000);
});

test("normalizes names, billing identifiers, and email; accepts PAN and GSTIN", () => {
  const result = registrationSchema.parse({ ...valid, memberName: "  Test Member  ", email: "Member@Example.COM", billingDetails: " abcde1234f " });
  assert.equal(result.memberName, "Test Member");
  assert.equal(result.email, "member@example.com");
  assert.equal(result.billingDetails, "ABCDE1234F");
  assert.equal(registrationSchema.safeParse({ ...valid, billingDetails: "22ABCDE1234F1Z5" }).success, true);
});

test("rejects missing or invalid required member fields", () => {
  for (const override of [{ memberName: " " }, { email: "invalid" }, { phone: "123" }, { phone: "1234567890" }, { billingDetails: "invalid" }, { submissionId: "invalid" }]) {
    assert.equal(registrationSchema.safeParse({ ...valid, ...override }).success, false);
  }
});

test("rejects negative, fractional, oversized, and coerced fee selections", () => {
  for (const override of [{ participationQuantity: 0 }, { participationQuantity: 21 }, { participationQuantity: 1.5 }, { standeeQuantity: -1 }, { standeeQuantity: 11 }, { standeeQuantity: "1" }, { presentationSelected: "false" }]) {
    assert.equal(registrationSchema.safeParse({ ...valid, ...override }).success, false);
  }
});

test("does not trust a client-provided price, total, or payment status", () => {
  const result = registrationSchema.parse({ ...valid, totalPaise: 1, paymentStatus: "paid", participationUnitPaise: 1 });
  assert.equal(calculateTotal(result), 118000);
  assert.equal("paymentStatus" in result, false);
  assert.equal("totalPaise" in result, false);
});

test("requires exactly one valid name for each selected participant", () => {
  assert.deepEqual(registrationSchema.parse(valid).additionalParticipantNames, []);
  const group = { ...valid, participationQuantity: 3, additionalParticipantNames: ["  Second Member  ", "তৃতীয় সদস্য"] };
  assert.deepEqual(registrationSchema.parse(group).additionalParticipantNames, ["Second Member", "তৃতীয় সদস্য"]);
  for (const names of [[], ["Only One Guest"], ["Second Member", " "], ["Second Member", "x".repeat(121)], ["Second", "Third", "Extra"]]) {
    assert.equal(registrationSchema.safeParse({ ...group, additionalParticipantNames: names }).success, false);
  }
  assert.equal(registrationSchema.safeParse({ ...valid, additionalParticipantNames: ["Uncounted Guest"] }).success, false);
});

test("supports the full participant limit with a name for every guest", () => {
  const group = { ...valid, participationQuantity: 20, additionalParticipantNames: Array.from({ length: 19 }, (_, index) => `Guest ${index + 2}`) };
  assert.equal(registrationSchema.safeParse(group).success, true);
  assert.equal(calculateTotal(group), 2360000);
});
