import crypto from 'node:crypto';
import config from './config.js';

/**
 * Build the Lazada request signature.
 * Algorithm (Lazada Open Platform, sign_method=sha256):
 *   1. Sort all request params (system + business) by key.
 *   2. Concatenate apiPath + (key+value) for each sorted param.
 *   3. HMAC-SHA256 with appSecret, hex digest, UPPERCASE.
 * @param {string} apiPath e.g. "/order/get"
 * @param {Record<string,string>} params all params except `sign`
 */
export function signLazada(apiPath, params) {
  const sorted = Object.keys(params).sort();
  let base = apiPath;
  for (const key of sorted) base += key + params[key];
  return crypto
    .createHmac('sha256', config.lazada.appSecret)
    .update(base, 'utf8')
    .digest('hex')
    .toUpperCase();
}

/**
 * Call a Lazada REST endpoint (GET).
 * @param {string} apiPath e.g. "/orders/get"
 * @param {Record<string,string>} [bizParams] business params
 * @param {boolean} [returnRaw] if true, return raw Response instead of JSON
 */
export async function callLazada(apiPath, bizParams = {}, returnRaw = false) {
  const sysParams = {
    app_key: config.lazada.appKey,
    access_token: config.lazada.accessToken,
    sign_method: 'sha256',
    timestamp: String(Date.now()),
  };
  const allParams = { ...sysParams, ...bizParams };
  allParams.sign = signLazada(apiPath, allParams);

  const qs = new URLSearchParams(allParams).toString();
  const url = `${config.lazada.apiBase}${apiPath}?${qs}`;

  const res = await fetch(url);
  
  if (returnRaw) {
    return res;
  }
  
  const json = await res.json().catch(() => ({}));
  if (json.code && json.code !== '0') {
    throw new Error(`Lazada ${apiPath} error ${json.code}: ${json.message || ''}`);
  }
  return json;
}

/** Fetch a single order's header info. */
export async function getOrder(orderId) {
  const json = await callLazada('/order/get', { order_id: String(orderId) });
  return json.data || null;
}

/** Fetch the line items of an order. */
export async function getOrderItems(orderId) {
  const json = await callLazada('/order/items/get', { order_id: String(orderId) });
  return json.data || [];
}

/** List orders created on/after an ISO-8601 datetime (polling fallback). */
export async function getOrders(createdAfterISO, status = 'pending') {
  const json = await callLazada('/orders/get', {
    created_after: createdAfterISO,
    status,
    sort_direction: 'DESC',
    offset: '0',
    limit: '50',
  });
  return json.data?.orders || [];
}

/**
 * Normalize a Lazada order (+items) into the shared notification shape.
 */
export function normalizeLazadaOrder(order, items = []) {
  const products = items.map((it) => ({
    name: it.name,
    sku: it.sku || it.shop_sku,
    qty: 1, // Lazada returns one entry per unit; group upstream if needed
    variation: it.variation || '',
  }));
  return {
    platform: 'Lazada',
    orderId: String(order.order_id ?? order.order_number ?? ''),
    orderNumber: String(order.order_number ?? order.order_id ?? ''),
    buyer: order.customer_first_name
      ? `${order.customer_first_name} ${order.customer_last_name || ''}`.trim()
      : (order.address_shipping?.first_name || 'N/A'),
    total: order.price,
    currency: '',
    itemCount: order.items_count ?? products.length,
    status: order.statuses?.[0] || order.status || 'pending',
    createdAt: order.created_at,
    shipTo: [
      order.address_shipping?.city,
      order.address_shipping?.country,
    ].filter(Boolean).join(', '),
    products,
  };
}

/**
 * Get shipping label document URL for one or more order items.
 * Returns a URL to download the PDF shipping label (ฉลากจัดส่ง).
 * @param {string[]} orderItemIds - Array of trade_order_line_id values
 * @returns {Promise<string>} URL to the PDF document
 */
export async function getShippingLabel(orderItemIds) {
  const json = await callLazada('/order/document/get', {
    doc_type: 'shippingLabel',
    order_item_ids: JSON.stringify(orderItemIds),
  });
  
  if (json.data?.document?.file) {
    return json.data.document.file;
  }
  
  throw new Error('No shipping label URL returned from Lazada');
}

/**
 * Get shipping label for an entire order (all items).
 * @param {string} orderId - The trade_order_id
 * @returns {Promise<string>} URL to the PDF shipping label
 */
export async function getOrderShippingLabel(orderId) {
  // First get order items to extract line IDs
  const items = await getOrderItems(orderId);
  if (!items.length) {
    throw new Error(`No items found for order ${orderId}`);
  }
  
  const orderItemIds = items
    .map(item => item.order_item_id)
    .filter(Boolean);
  
  if (!orderItemIds.length) {
    throw new Error(`No valid order_item_ids found for order ${orderId}`);
  }
  
  console.log(`[lazada] Fetching shipping label for ${orderItemIds.length} item(s)`);
  return getShippingLabel(orderItemIds);
}

export default { 
  signLazada, 
  callLazada, 
  getOrder, 
  getOrderItems, 
  getOrders, 
  normalizeLazadaOrder,
  getShippingLabel,
  getOrderShippingLabel,
};
