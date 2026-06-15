import crypto from 'node:crypto';
import config from './config.js';

/**
 * Verify a LINE webhook signature (x-line-signature header).
 * @param {string|Buffer} rawBody - the exact raw request body bytes
 * @param {string} signature - value of the x-line-signature header
 * @returns {boolean}
 */
export function verifyLineSignature(rawBody, signature) {
  if (!config.line.channelSecret || !signature) return false;
  const expected = crypto
    .createHmac('sha256', config.line.channelSecret)
    .update(rawBody)
    .digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Push one or more messages to a LINE target (group / room / user).
 * @param {object[]} messages - LINE message objects (max 5)
 * @param {string} [to] - override target id (defaults to LINE_TARGET_ID)
 */
export async function pushMessages(messages, to = config.line.targetId) {
  if (!config.line.channelAccessToken) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
  }
  if (!to) {
    throw new Error('No LINE target id (set LINE_TARGET_ID or pass "to")');
  }

  const res = await fetch(config.line.pushUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.line.channelAccessToken}`,
    },
    body: JSON.stringify({ to, messages }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LINE push failed (${res.status}): ${detail}`);
  }
  return res.json().catch(() => ({}));
}

/** Convenience: push a single plain-text message. */
export function pushText(text, to) {
  return pushMessages([{ type: 'text', text }], to);
}

export default { verifyLineSignature, pushMessages, pushText };
