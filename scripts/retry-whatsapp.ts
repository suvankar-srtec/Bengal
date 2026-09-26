import { getDatabase } from "../src/lib/db";
import { deliverWhatsAppPassesSafely } from "../src/lib/whatsapp-delivery";

// Run with npm run whatsapp:retry. Only existing queued deliveries are considered.
async function main() {
const database = getDatabase();
try {
  const rows = await database.query<{ registration_id: string }>(`
    SELECT registration_id FROM public.bbc_whatsapp_pass_deliveries
    WHERE ((status IN ('pending', 'failed') AND attempts < 3 AND next_attempt_at <= NOW())
      OR (status = 'sending' AND updated_at < NOW() - INTERVAL '2 minutes'))
      AND media_expires_at > NOW()
    ORDER BY updated_at LIMIT 25`);
  for (const row of rows.rows) await deliverWhatsAppPassesSafely(row.registration_id);
  console.log(`Checked ${rows.rowCount} queued WhatsApp deliveries.`);
} finally { await database.end(); }

}
void main().catch(() => { console.error("WhatsApp verification/worker failed."); process.exitCode = 1; });
