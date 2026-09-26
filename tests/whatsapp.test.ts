import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  participantPass,
  renderParticipantPass,
  type PassRegistration,
} from "../src/lib/participant-pass";
import {
  sendWhatsAppPasses,
  whatsappConfiguration,
  WhatsAppError,
} from "../src/lib/wapmonkey";

const config = {
  apiKey: "unit-test-key",
  deviceToken: "unit-test-device",
  origin: "https://example.com",
};
const input = {
  phone: "+919000000000",
  message: "Your test pass",
  media: [
    {
      url: "https://example.com/api/passes/token/1.png",
      name: "pass.png",
      caption: "Test participant",
    },
  ],
};
const registration: PassRegistration = {
  id: "a79b48c1-4710-4774-af09-360b504a2868",
  reference: "BBC-TEST",
  event_id: "42",
  event_name: "September Networking",
  event_date: "2026-09-28",
  participant_names: ["Aditi & Sen", "Rohan | NAME:someone"],
  meal_choice: "lunch",
};

test("WapMonkey gets its documented authentication, recipient and media fields", async () => {
  let requests = 0;
  const mockFetch: typeof fetch = async (url, options) => {
    requests++;
    assert.equal(url, "https://api.wapmonkey.com/v1/sendmessage");
    assert.equal(
      new Headers(options?.headers).get("Authorization"),
      config.apiKey,
    );
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body, {
      numbers: "919000000000",
      message: input.message,
      media: input.media,
      device_token: config.deviceToken,
      delay: "0",
      schedule: null,
    });
    assert.equal(options?.redirect, "error");
    return Response.json({
      status: 1,
      data: { messageId: "test-accepted-id" },
    });
  };
  assert.equal(
    await sendWhatsAppPasses(input, config, mockFetch),
    "test-accepted-id",
  );
  assert.equal(requests, 1);
});

test("HTTP 200 with provider rejection is not reported as sent", async () => {
  await assert.rejects(
    sendWhatsAppPasses(input, config, async () =>
      Response.json({ status: 0, description: "Rejected" }),
    ),
    (error: unknown) =>
      error instanceof WhatsAppError &&
      error.code === "provider_rejected" &&
      !error.uncertain,
  );
});

test("ambiguous responses are not safe to automatically retry", async () => {
  const responses: Array<() => Promise<Response>> = [
    async () => {
      throw new Error("timeout");
    },
    async () => new Response("bad gateway", { status: 502 }),
    async () => new Response("not JSON"),
    async () => Response.json({ status: 1 }),
    async () => Response.json({ unexpected: true }),
  ];
  for (const response of responses) {
    await assert.rejects(
      sendWhatsAppPasses(input, config, response),
      (error: unknown) => error instanceof WhatsAppError && error.uncertain,
    );
  }
});

test("invalid phone numbers never reach the provider", async () => {
  let called = false;
  await assert.rejects(
    sendWhatsAppPasses(
      { ...input, phone: "919000000000,919111111111" },
      config,
      async () => {
        called = true;
        return Response.json({ status: 1 });
      },
    ),
  );
  assert.equal(called, false);
});

test("configuration requires server credentials and a public HTTPS origin", () => {
  const credentials = {
    WAPMONKEY_API_KEY: "key",
    WAPMONKEY_DEVICE_TOKEN: "device",
  };
  assert.throws(() =>
    whatsappConfiguration({ APP_PUBLIC_URL: "https://example.com" }),
  );
  for (const url of [
    "",
    "http://example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://10.0.0.1",
    "https://example.com/event/a",
    "https://user:pass@example.com",
  ]) {
    assert.throws(() =>
      whatsappConfiguration({ ...credentials, APP_PUBLIC_URL: url }),
    );
  }
  assert.equal(
    whatsappConfiguration({
      ...credentials,
      APP_PUBLIC_URL: "https://example.com/",
    }).origin,
    "https://example.com",
  );
});

test("QR data binds the stored event, registration, participant and meal", () => {
  const pass = participantPass(registration, 1);
  assert.equal(pass.passId, "BBC-TEST-P2");
  assert.match(pass.payload, /\|EVENT:42\|/);
  assert.match(pass.payload, /\|PARTICIPANT:2\|PASS:BBC-TEST-P2\|/);
  assert.match(pass.payload, /NAME:Rohan%20%7C%20NAME%3Asomeone\|MEAL:lunch$/);
  assert.throws(() => participantPass(registration, 2));
});

test("pass renderer produces a full size PNG with a nonempty QR area and escaped names", async () => {
  const image = await renderParticipantPass(
    { ...registration, participant_names: ['Aditi <Sen> & "Co"'] },
    0,
  );
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 750);
  assert.equal(metadata.height, 1050);
  const qr = await sharp(image)
    .extract({ left: 135, top: 374, width: 480, height: 480 })
    .stats();
  assert.ok(qr.channels[0].min < 20);
  assert.ok(qr.channels[0].max > 240);
  assert.ok(qr.channels[0].stdev > 60);
});
