import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Set env BEFORE importing modules that read config.
process.env.LAZADA_APP_SECRET = 'lzd_secret';
process.env.SHOPEE_PARTNER_KEY = 'shp_secret';
process.env.SHOPEE_PARTNER_ID = '1001';
process.env.SHOPEE_ACCESS_TOKEN = 'tok';
process.env.SHOPEE_SHOP_ID = '2002';
process.env.LINE_CHANNEL_SECRET = 'line_secret';

const { signLazada } = await import('../src/lazada.js');
const { signShopee, verifyShopeePush } = await import('../src/shopee.js');
const { verifyLineSignature } = await import('../src/line.js');
const { buildFlexMessage } = await import('../src/notifier.js');

test('Lazada sign = HMAC-SHA256(apiPath + sorted k+v), uppercase hex', () => {
  const apiPath = '/order/get';
  const params = { app_key: '123', order_id: '99', timestamp: '5' };
  const sorted = ['app_key', 'order_id', 'timestamp'];
  let base = apiPath;
  for (const k of sorted) base += k + params[k];
  const expected = crypto.createHmac('sha256', 'lzd_secret').update(base).digest('hex').toUpperCase();
  assert.equal(signLazada(apiPath, params), expected);
});

test('Shopee sign = HMAC-SHA256(partner_id+path+ts+token+shop)', () => {
  const apiPath = '/api/v2/order/get_order_detail';
  const ts = 1700000000;
  const base = '1001' + apiPath + ts + 'tok' + '2002';
  const expected = crypto.createHmac('sha256', 'shp_secret').update(base).digest('hex');
  assert.equal(signShopee(apiPath, ts), expected);
});

test('Shopee push signature verifies (url|body)', () => {
  const url = 'https://x.example.com/webhook/shopee';
  const body = '{"code":3,"data":{"ordersn":"ABC"}}';
  const sig = crypto.createHmac('sha256', 'shp_secret').update(`${url}|${body}`).digest('hex');
  assert.equal(verifyShopeePush(url, body, sig), true);
  assert.equal(verifyShopeePush(url, body, 'deadbeef'), false);
});

test('LINE signature verifies (base64 HMAC of raw body)', () => {
  const body = Buffer.from('{"events":[]}');
  const sig = crypto.createHmac('sha256', 'line_secret').update(body).digest('base64');
  assert.equal(verifyLineSignature(body, sig), true);
  assert.equal(verifyLineSignature(body, 'wrong'), false);
});

test('Flex message builds with required fields and alt text', () => {
  const msg = buildFlexMessage({
    platform: 'Shopee',
    orderId: 'SN1',
    orderNumber: 'SN1',
    buyer: 'somchai',
    total: 350,
    currency: 'THB',
    itemCount: 2,
    status: 'READY_TO_SHIP',
    createdAt: '2026-06-15T10:00:00Z',
    shipTo: 'Bangkok',
    products: [{ name: 'T-Shirt', sku: 'TS-01', qty: 2, variation: 'L/Black' }],
  });
  assert.equal(msg.type, 'flex');
  assert.match(msg.altText, /New Shopee order SN1/);
  assert.equal(msg.contents.type, 'bubble');
});
