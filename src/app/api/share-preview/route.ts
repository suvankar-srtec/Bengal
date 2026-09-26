import sharp from "sharp";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";

export const runtime = "nodejs";

let previewPromise: Promise<Buffer> | undefined;

function buildPreview() {
  previewPromise ??= (async () => {
    const logo = await sharp(
      Buffer.from(BBC_LOGO_DATA_URL.split(",")[1], "base64"),
    )
      .resize({ width: 560, height: 430, fit: "inside" })
      .png()
      .toBuffer();

    return sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 4,
        background: "#ffffff",
      },
    })
      .composite([{ input: logo, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  })();

  return previewPromise;
}

export async function GET() {
  try {
    const png = await buildPreview();
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.length),
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
