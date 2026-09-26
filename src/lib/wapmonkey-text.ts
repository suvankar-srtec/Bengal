import "server-only";
import { whatsappConfiguration, WhatsAppError } from "./wapmonkey";

export async function sendWhatsAppText(
  input: { phone: string; message: string },
  config = whatsappConfiguration(),
  request: typeof fetch = fetch,
) {
  const numbers = input.phone.replace(/^\+/, "");
  if (!/^[1-9]\d{7,14}$/.test(numbers) || !input.message.trim()) {
    throw new WhatsAppError("invalid_recipient_or_message");
  }

  let response: Response;
  try {
    response = await request("https://api.wapmonkey.com/v1/sendmessage", {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        Authorization: config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        numbers,
        message: input.message,
        device_token: config.deviceToken,
        delay: "0",
        schedule: null,
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new WhatsAppError("provider_response_unknown", true);
  }

  if (response.status >= 500) throw new WhatsAppError("provider_response_unknown", true);
  if (!response.ok) throw new WhatsAppError(`provider_http_${response.status}`);

  let result: { status?: unknown; data?: { messageId?: unknown } };
  try {
    result = await response.json();
  } catch {
    throw new WhatsAppError("provider_response_unknown", true);
  }

  if (result?.status !== 1) {
    if (result?.status === 0) throw new WhatsAppError("provider_rejected");
    throw new WhatsAppError("provider_response_unknown", true);
  }

  if (typeof result.data?.messageId !== "string" || !result.data.messageId) {
    throw new WhatsAppError("provider_response_unknown", true);
  }

  return result.data.messageId;
}
