const assert = require('node:assert/strict');
const test = require('node:test');
const { GET } = require('../src/app/m/[eventId]/route.ts');
const { venueMapUrl } = require('../src/lib/venue-map.ts');

test('short map route preserves exact saved pins and full address searches', async () => {
  const previous = globalThis.registrationPool;
  let event; let fail = false; let queries = 0;
  globalThis.registrationPool = { async query(sql, values) {
    queries++; assert.deepEqual(values, [42]);
    if (fail) throw new Error('test unavailable');
    return { rows: event ? [event] : [] };
  } };
  const get = (eventId = '42') => GET(new Request('https://example.com/m/' + eventId), { params: Promise.resolve({ eventId }) });
  try {
    const pin = 'https://www.google.com/maps/search/?api=1&query=Sunhill%20Portico&query_place_id=ChIJ_test_exact_place';
    event = { venue: 'Old address', google_maps_url: pin };
    let response = await get();
    assert.equal(response.status, 307); assert.equal(response.headers.get('location'), pin);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    event = { venue: 'Full address, Nazrul Sarani, Siliguri, West Bengal 734001', google_maps_url: '' };
    response = await get(); assert.equal(response.headers.get('location'), venueMapUrl(event.venue));
    event = { venue: 'Venue', google_maps_url: 'https://maps.app.goo.gl/exactPin' };
    assert.equal((await get()).headers.get('location'), event.google_maps_url);
    event = { venue: 'Venue', google_maps_url: 'https://evil.example/' };
    assert.equal((await get()).headers.get('location'), venueMapUrl('Venue'));
    event = null; assert.equal((await get()).status, 404);
    const beforeInvalid = queries; assert.equal((await get('../evil')).status, 404); assert.equal(queries, beforeInvalid);
    fail = true; assert.equal((await get()).status, 503);
  } finally { globalThis.registrationPool = previous; }
});
