import { pushMessages } from './line.js';
import { isNew, markSeen } from './store.js';

const PLATFORM_COLOR = {
  Lazada: '#0F146D',
  Shopee: '#EE4D2D',
};

/** Build a LINE Flex Message bubble for one normalized order. */
export function buildFlexMessage(order) {
  const color = PLATFORM_COLOR[order.platform] || '#333333';
  const hasShippingLabel = order.shippingLabelUrl && order.platform === 'Lazada';

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
        spacing: 'sm',
        contents: [
          hasShippingLabel ? {
            type: 'button',
            action: {
              type: 'uri',
              label: '📄 ดาวน์โหลดฉลากจัดส่ง (Shipping Label)',
              uri: order.shippingLabelUrl,
            },
            style: 'primary',
            color: color,
            height: 'sm',
          } : null,
          { type: 'text', text: order.createdAt || '', size: 'xs', color: '#AAAAAA', align: 'center', margin: hasShippingLabel ? 'sm' : 'none' },
        ].filter(Boolean),
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
 * @param {object} order - Normalized order object
 * @param {string} [shippingLabelUrl] - Optional shipping label PDF URL
 * @returns {Promise<boolean>} true if a notification was sent, false if duplicate
 */
export async function notifyOrder(order, shippingLabelUrl = null) {
  const key = `${order.platform}:${order.orderId}`;
  
  // CRITICAL: Check and mark as seen IMMEDIATELY to prevent race conditions
  // Lazada sends multiple webhooks per order (one per item) at the same time
  if (!isNew(key)) {
    console.log(`[notify] skip duplicate ${key}`);
    return false;
  }
  
  // Mark as seen RIGHT NOW before any async operations
  markSeen(key);
  
  // Add shipping label URL to order object if provided
  if (shippingLabelUrl) {
    order.shippingLabelUrl = shippingLabelUrl;
    console.log(`[notify] Including shipping label URL`);
  }
  
  await pushMessages([buildFlexMessage(order)]);
  console.log(`[notify] sent ${key} (${order.itemCount} items)${shippingLabelUrl ? ' with shipping label' : ''}`);
  return true;
}

export default { buildFlexMessage, notifyOrder };
