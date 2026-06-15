/**
 * Polling fallback — use this when you cannot expose a public webhook URL.
 * Run standalone:  npm run poll
 * Or set ENABLE_POLLING=true and it starts alongside the server.
 *
 * It asks each platform for orders created since the last check and
 * notifies any it hasn't seen before (dedup handled in the store).
 */
import config from './config.js';
import * as lazada from './lazada.js';
import * as shopee from './shopee.js';
import { notifyOrder } from './notifier.js';

let lastCheckMs = Date.now();

async function pollLazada(sinceMs) {
  try {
    const createdAfter = new Date(sinceMs).toISOString();
    const orders = await lazada.getOrders(createdAfter, 'pending');
    for (const o of orders) {
      const items = await lazada.getOrderItems(o.order_id).catch(() => []);
      await notifyOrder(lazada.normalizeLazadaOrder(o, items));
    }
    if (orders.length) console.log(`[poll/lazada] processed ${orders.length} order(s)`);
  } catch (err) {
    console.error('[poll/lazada] error:', err.message);
  }
}

async function pollShopee(sinceMs) {
  try {
    const from = Math.floor(sinceMs / 1000);
    const to = Math.floor(Date.now() / 1000);
    const orderSns = await shopee.getOrderList(from, to, 'READY_TO_SHIP');
    if (!orderSns.length) return;
    // get_order_detail accepts up to 50 order_sn at once.
    const details = await shopee.getOrderDetail(orderSns.slice(0, 50));
    for (const d of details) {
      await notifyOrder(shopee.normalizeShopeeOrder(d));
    }
    console.log(`[poll/shopee] processed ${details.length} order(s)`);
  } catch (err) {
    console.error('[poll/shopee] error:', err.message);
  }
}

export async function pollOnce() {
  const since = lastCheckMs;
  lastCheckMs = Date.now();
  await Promise.all([pollLazada(since), pollShopee(since)]);
}

export function startPolling() {
  const ms = config.polling.intervalSeconds * 1000;
  console.log(`[poll] starting, every ${config.polling.intervalSeconds}s`);
  pollOnce();
  return setInterval(pollOnce, ms);
}

// Run directly:  node src/poller.js
if (import.meta.url === `file://${process.argv[1]}`) {
  startPolling();
}
