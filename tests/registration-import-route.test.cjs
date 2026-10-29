const assert = require('node:assert/strict');
const test = require('node:test');
const { adminSessionToken } = require('../src/lib/admin-auth.ts');
const headers = require('next/headers');
const originalCookies = headers.cookies;
const originalPool = globalThis.registrationPool;
let token;
headers.cookies = async () => ({ get: () => token ? { value: token } : undefined });
const { POST } = require('../src/app/api/admin/import-registrations/route.ts');

const header = 'Payment ID,Item Name,Payment Status,Member Name,Email,Phone,Item Quantity,Total Payment Amount';
function request(lines) {
  const form = new FormData(); form.set('eventId', '12');
  form.set('file', new File([[header, ...lines].join('\n')], 'payments.csv'));
  return new Request('http://localhost/api/admin/import-registrations', { method: 'POST', body: form });
}

test('import API saves only valid captured rows, returns skipped details, and rejects non-admins', async () => {
  const inserted = [];
  let committed = false;
  let connects = 0;
  const client = {
    release() {},
    async query(sql, values = []) {
      if (sql === 'COMMIT') committed = true;
      if (sql.startsWith('INSERT INTO public.bbc_event_registrations')) {
        inserted.push(values); return { rows: [{ id: values[0], reference: values[3] }] };
      }
      if (sql.includes('d.media_token')) return { rows: [{ media_token: 'a'.repeat(64), status: 'manual', event_started: true, event_resend_at: null }] };
      return { rows: [] };
    },
  };
  globalThis.registrationPool = {
    async query() { return { rows: [{ id: 12, title_en: 'Test Event', event_date: '2026-10-29', participation_unit_paise: 118000, included_meals: ['lunch'] }] }; },
    async connect() { connects++; return client; },
  };
  const lines = [
    'pay_fail,Amount,failed,Failed Member,failed@example.com,9000000000,1,1180',
    'pay_bad,Amount,captured,Invalid Member,invalid@example.com,123,1,1180',
    'pay_ok,Amount,captured,Valid Member,valid@example.com,9000000001,1,2360',
    'pay_ok,Add Family member,captured,Valid Member,valid@example.com,9000000001,1,2360',
    'pay_incomplete,Amount,,Pending Member,pending@example.com,9000000002,1,1180',
  ];
  try {
    assert.equal((await POST(request(lines))).status, 401);
    token = adminSessionToken({ role: 'manager', managerId: 'test', eventId: 12, userId: 'test' });
    assert.equal((await POST(request(lines))).status, 403);
    token = adminSessionToken({ role: 'admin' });
    const response = await POST(request(lines));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.count, 1); assert.equal(data.skippedCount, 3);
    assert.equal(data.results[0].participants, 2); assert.equal(data.results[0].canSendPasses, true);
    assert.equal(data.results[0].whatsapp, '+919000000001');
    assert.equal(data.rowErrors[0].row, 3);
    assert.equal(inserted.length, 1); assert.equal(inserted[0][8], 'valid@example.com');
    assert.equal(committed, true);
    const none = await POST(request([lines[0], lines[4]]));
    assert.equal(none.status, 400); assert.equal((await none.json()).skippedCount, 2);
    assert.equal(connects, 1);
  } finally {
    headers.cookies = originalCookies;
    globalThis.registrationPool = originalPool;
  }
});
