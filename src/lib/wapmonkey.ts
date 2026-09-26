import "server-only";

export class WhatsAppError extends Error {
  constructor(readonly code: string, readonly uncertain = false) { super(code); }
}

export function whatsappConfiguration(env: Record<string, string | undefined> = process.env) {
  const apiKey = env.WAPMONKEY_API_KEY?.trim();
  const deviceToken = env.WAPMONKEY_DEVICE_TOKEN?.trim();
  if (!apiKey || !deviceToken) throw new WhatsAppError("credentials_missing");
  let origin: URL;
  try { origin = new URL(env.APP_PUBLIC_URL ?? ""); }
  catch { throw new WhatsAppError("public_url_missing"); }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/"
    || origin.search || origin.hash || !origin.hostname.includes(".")
    || /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin.hostname)
    || origin.hostname.endsWith(".local")) throw new WhatsAppError("public_url_invalid");
  return { apiKey, deviceToken, origin: origin.origin };
}

type Media = { url: string; name: string; caption: string };

export async function sendWhatsAppPasses(
  input: { phone: string; message: string; media: Media[] },
  config = whatsappConfiguration(),
  request: typeof fetch = fetch,
) {
  const numbers = input.phone.replace(/^\+/, "");
  if (!/^[1-9]\d{7,14}$/.test(numbers) || input.media.length < 1 || input.media.length > 20) {
    throw new WhatsAppError("invalid_recipient_or_passes");
  }
  let response: Response;
  try {
    response = await request("https://api.wapmonkey.com/v1/sendmessage", {
      method: "POST", redirect: "error", cache: "no-store",
      headers: { Authorization: config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        numbers, message: input.message, media: input.media,
        device_token: config.deviceToken, delay: "0", schedule: null,
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch { throw new WhatsAppError("provider_response_unknown", true); }
  // Never log provider bodies: they can echo credentials or recipient details.
  if (response.status >= 500) throw new WhatsAppError("provider_response_unknown", true);
  if (!response.ok) throw new WhatsAppError(`provider_http_${response.status}`);
  let result: { status?: unknown; data?: { messageId?: unknown } };
  try { result = await response.json(); }
  catch { throw new WhatsAppError("provider_response_unknown", true); }
  if (result?.status !== 1) {
    if (result?.status === 0) throw new WhatsAppError("provider_rejected");
    throw new WhatsAppError("provider_response_unknown", true);
  }
  if (typeof result.data?.messageId !== "string" || !result.data.messageId) {
    throw new WhatsAppError("provider_response_unknown", true);
  }
  return result.data.messageId;
}
