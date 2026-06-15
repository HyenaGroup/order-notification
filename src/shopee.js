import crypto from 'node:crypto';
import config from './config.js';

/**
 * Sign a Shopee API v2 shop-level request.
 * base_string = partner_id + api_path + timestamp + access_token + shop_id
 * sign = HMAC-SHA256(partner_key, base_string) -> lowercase hex
 */
export function signShopee(apiPath, timestamp) {
  const base =
    config.shopee.partnerId +
    apiPath +
    timestamp +
    config.shopee.accessToken +
    config.shopee.shopId;
  return crypto
    .createHmac('sha256', config.shopee.partnerKey)
    .update(base, 'utf8')
    .digest('hex');
}

/**
 * Verify a Shopee push (webhook) signature.
 * Shopee signs:  HMAC-SHA256(partner_key, callbackUrl + "|" + rawBody)
 * and sends it in the "Authorization" header.
 * @param {string} callbackUrl the full public callback URL Shopee called
 * @param {string|Buffer} rawBody exact raw request body
 * @param {string} authHeader value of the Authorization header
 */
export function verifyShopeePush(callbackUrl, rawBody, authHeader) {
  if (!config.shopee.partnerKey || !authHeader) return false;
  const base = `${callbackUrl}|${rawBody}`;
  const expected = crypto
    .createHmac('sha256', config.shopee.partnerKey)
    .update(base, 'utf8')
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(authHeader));
  } catch {
    return false;
  }
}

/** Call a Shopee API v2 GET endpoint. */
export async function callShopee(apiPath, bizParams = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signShopee(apiPath, timestamp);
  const params = {
    partner_id: config.shopee.partnerId,
    timestamp: String(timestamp),
    access_token: config.shopee.accessToken,
    shop_id: config.shopee.shopId,
    sign,
    ...bizParams,
  };
  const qs = new URLSearchParams(params).toString();
  const url = `${config.shopee.apiBase}${apiPath}?${qs}`;

  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (json.error) {
    throw new Error(`Shopee ${apiPath} error ${json.error}: ${json.message || ''}`);
  }
  return json;
}

/** Fetch full details for one or more order_sn (comma-joined, max 50). */
export async function getOrderDetail(orderSnList) {
  const list = Array.isArray(orderSnList) ? orderSnList.join(',') : String(orderSnList);
  const json = await callShopee('/api/v2/order/get_order_detail', {
    order_sn_list: list,
    response_optional_fields:
      'buyer_username,item_list,total_amount,currency,order_status,create_time,recipient_address',
  });
  return json.response?.order_list || [];
}

/** List orders within a recent time window (polling fallback). */
export async function getOrderList(fromTs, toTs, status = 'READY_TO_SHIP') {
  const json = await callShopee('/api/v2/order/get_order_list', {
    time_range_field: 'create_time',
    time_from: String(fromTs),
    time_to: String(toTs),
    page_size: '50',
    order_status: status,
  });
  return (json.response?.order_list || []).map((o) => o.order_sn);
}

/** Normalize a Shopee order detail into the shared notification shape. */
export function normalizeShopeeOrder(order) {
  const products = (order.item_list || []).map((it) => ({
    name: it.item_name,
    sku: it.item_sku || it.model_sku,
    qty: it.model_quantity_purchased ?? 1,
    variation: it.model_name || '',
  }));
  const addr = order.recipient_address || {};
  return {
    platform: 'Shopee',
    orderId: order.order_sn,
    orderNumber: order.order_sn,
    buyer: order.buyer_username || addr.name || 'N/A',
    total: order.total_amount,
    currency: order.currency || '',
    itemCount: products.reduce((s, p) => s + (p.qty || 1), 0),
    status: order.order_status || 'READY_TO_SHIP',
    createdAt: order.create_time ? new Date(order.create_time * 1000).toISOString() : '',
    shipTo: [addr.city, addr.state].filter(Boolean).join(', '),
    products,
  };
}

export default {
  signShopee,
  verifyShopeePush,
  callShopee,
  getOrderDetail,
  getOrderList,
  normalizeShopeeOrder,
};
