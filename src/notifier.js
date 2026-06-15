import { pushMessages } from './line.js';
import { isNew, markSeen } from './store.js';

const PLATFORM_COLOR = {
  Lazada: '#0F146D',
  Shopee: '#EE4D2D',
};

/** Build a LINE Flex Message bubble for one normalized order. */
export function buildFlexMessage(order) {
  const color = PLATFORM_COLOR[order.platform] || '#333333';

  const itemRows = (order.products || []).slice(0, 12).map((p) => ({
    type: 'box',
    layout: 'baseline',
    contents: [
      { type: 'text', text: `${p.qty}x`, size: 'sm', color: '#888888', flex: 1 },
      {
        type: 'text',
        text: [p.name, p.variation].filter(Boolean).join(' — '),
        size: 'sm',
        color: '#111111',
        wrap: true,
        flex: 6,
      },
    ],
  }));
  if ((order.products || []).length > 12) {
    itemRows.push({
      type: 'text',
      text: `…and ${order.products.length - 12} more item(s)`,
      size: 'xs',
      color: '#888888',
    });
  }

  const skuList = (order.products || [])
    .map((p) => p.sku)
    .filter(Boolean)
    .join(', ');

  return {
    type: 'flex',
    altText: `📦 New ${order.platform} order ${order.orderNumber} — ${order.itemCount} item(s)`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: color,
        paddingAll: '12px',
        contents: [
          { type: 'text', text: `📦 NEW ${order.platform.toUpperCase()} ORDER`, color: '#FFFFFF', weight: 'bold', size: 'md' },
          { type: 'text', text: `Order ${order.orderNumber}`, color: '#FFFFFF', size: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          kv('Buyer', order.buyer),
          kv('Items', `${order.itemCount}`),
          order.total ? kv('Total', `${order.total} ${order.currency}`.trim()) : null,
          order.shipTo ? kv('Ship to', order.shipTo) : null,
          order.status ? kv('Status', order.status) : null,
          { type: 'separator', margin: 'md' },
          { type: 'text', text: 'PACK THIS:', weight: 'bold', size: 'sm', margin: 'md', color: color },
          ...itemRows,
          skuList ? { type: 'separator', margin: 'md' } : null,
          skuList ? kv('SKUs', skuList) : null,
        ].filter(Boolean),
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: order.createdAt || '', size: 'xs', color: '#AAAAAA', align: 'center' },
        ],
      },
    },
  };
}

function kv(label, value) {
  return {
    type: 'box',
    layout: 'baseline',
    contents: [
      { type: 'text', text: label, size: 'sm', color: '#888888', flex: 2 },
      { type: 'text', text: String(value ?? '-'), size: 'sm', color: '#111111', wrap: true, flex: 5 },
    ],
  };
}

/**
 * Notify the Packaging team about a normalized order, deduplicated.
 * @returns {Promise<boolean>} true if a notification was sent, false if duplicate
 */
export async function notifyOrder(order) {
  const key = `${order.platform}:${order.orderId}`;
  if (!isNew(key)) {
    console.log(`[notify] skip duplicate ${key}`);
    return false;
  }
  await pushMessages([buildFlexMessage(order)]);
  markSeen(key);
  console.log(`[notify] sent ${key} (${order.itemCount} items)`);
  return true;
}

export default { buildFlexMessage, notifyOrder };
