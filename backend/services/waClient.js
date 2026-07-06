const fs = require('fs');
const path = require('path');

const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function token() {
  return process.env.WHATSAPP_TOKEN;
}

function phoneNumberId() {
  return process.env.PHONE_NUMBER_ID;
}

async function graphFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Graph API ${res.status} on ${url}: ${body}`);
  }
  return res;
}

/**
 * Sends a plain text message.
 */
async function sendText(to, body) {
  await graphFetch(`${BASE_URL}/${phoneNumberId()}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body }
    })
  });
}

/**
 * Downloads received media (by media id) to destPath.
 * Returns the media's mime type.
 */
async function downloadMedia(mediaId, destPath) {
  // 1. Resolve the short-lived media URL
  const metaRes = await graphFetch(`${BASE_URL}/${mediaId}`);
  const meta = await metaRes.json();

  // 2. Download the binary (also requires the Bearer token)
  const fileRes = await graphFetch(meta.url);
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  fs.writeFileSync(destPath, buffer);

  return meta.mime_type;
}

/**
 * Uploads a local file to the Cloud API media endpoint. Returns the media id.
 */
async function uploadMedia(filePath, mime) {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mime);
  form.append(
    'file',
    new Blob([fs.readFileSync(filePath)], { type: mime }),
    path.basename(filePath)
  );

  const res = await graphFetch(`${BASE_URL}/${phoneNumberId()}/media`, {
    method: 'POST',
    body: form
  });
  const data = await res.json();
  return data.id;
}

/**
 * Sends a local .webp file as a real WhatsApp sticker.
 */
async function sendSticker(to, webpPath) {
  const mediaId = await uploadMedia(webpPath, 'image/webp');
  await graphFetch(`${BASE_URL}/${phoneNumberId()}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'sticker',
      sticker: { id: mediaId }
    })
  });
}

module.exports = {
  sendText,
  downloadMedia,
  sendSticker
};
