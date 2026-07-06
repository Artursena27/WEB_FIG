// E2E test of the bot state machine with a stubbed waClient (no Meta calls).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// --- Stub waClient BEFORE bot.js requires it ---
const waClientPath = require.resolve('./services/waClient.js');
const sent = [];
let pendingMediaFile = null; // file that downloadMedia will "download"

require.cache[waClientPath] = {
  id: waClientPath,
  filename: waClientPath,
  loaded: true,
  exports: {
    sendText: async (to, body) => { sent.push({ kind: 'text', to, body }); },
    sendSticker: async (to, webpPath) => {
      const buf = fs.readFileSync(webpPath);
      const meta = await sharp(buf, { animated: true }).metadata();
      sent.push({ kind: 'sticker', to, size: buf.length, pages: meta.pages || 1, w: meta.width });
    },
    downloadMedia: async (mediaId, destPath) => {
      fs.copyFileSync(pendingMediaFile, destPath);
      return 'stub/mime';
    }
  }
};

const { handleMessage } = require('./services/bot');
const uploadDir = path.join(__dirname, 'uploads');

async function makeTestMedia() {
  const dir = path.join(__dirname, 'test_media');
  fs.mkdirSync(dir, { recursive: true });

  // Static PNG 300x200 red
  const png = path.join(dir, 't.png');
  await sharp({ create: { width: 300, height: 200, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } })
    .png().toFile(png);

  // Animated GIF (4 frames)
  const frames = await Promise.all([[255,0,0],[0,255,0],[0,0,255],[255,255,0]].map(([r,g,b]) =>
    sharp({ create: { width: 100, height: 100, channels: 4, background: { r, g, b, alpha: 1 } } }).png().toBuffer()
  ));
  const gif = path.join(dir, 't.gif');
  await sharp(frames, { join: { animated: true } }).gif().toFile(gif);

  // Small MP4 via ffmpeg (3s testsrc)
  const ffmpegStatic = require('ffmpeg-static');
  const { execFileSync } = require('child_process');
  const mp4 = path.join(dir, 't.mp4');
  execFileSync(ffmpegStatic, ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=3:size=320x240:rate=15', mp4], { stdio: 'ignore' });

  return { png, gif, mp4, dir };
}

function lastSent() { return sent[sent.length - 1]; }
function assert(cond, label) {
  if (!cond) { console.error(`FAIL: ${label}`); process.exitCode = 1; }
  else console.log(`PASS: ${label}`);
}

(async () => {
  const media = await makeTestMedia();
  const user = '5511999990000';

  // 1. Help on random text
  await handleMessage({ from: user, type: 'text', text: { body: 'oi' } });
  assert(lastSent().kind === 'text' && lastSent().body.includes('/fig'), 'random text -> help');

  // 2. /fig -> prompt for file
  await handleMessage({ from: user, type: 'text', text: { body: '/fig' } });
  assert(lastSent().body.includes('Envie o arquivo'), '/fig -> ask for file');

  // 3. Send image -> sticker (static, <100KB, 512px)
  pendingMediaFile = media.png;
  await handleMessage({ from: user, type: 'image', image: { id: 'm1' } });
  let st = lastSent();
  assert(st.kind === 'sticker' && st.w === 512 && st.pages === 1 && st.size < 100 * 1024,
    `image -> static sticker 512px <100KB (got ${st.size}b, pages=${st.pages})`);

  // 4. /fig + GIF (as document) -> ANIMATED sticker
  await handleMessage({ from: user, type: 'text', text: { body: '/fig' } });
  pendingMediaFile = media.gif;
  await handleMessage({ from: user, type: 'document', document: { id: 'm2', mime_type: 'image/gif' } });
  st = lastSent();
  assert(st.kind === 'sticker' && st.pages > 1 && st.size < 500 * 1024,
    `gif -> ANIMATED sticker <500KB (pages=${st.pages}, ${st.size}b)`);

  // 5. /fig + video -> choice -> "1" full video -> animated sticker
  await handleMessage({ from: user, type: 'text', text: { body: '/figurinha' } });
  pendingMediaFile = media.mp4;
  await handleMessage({ from: user, type: 'video', video: { id: 'm3' } });
  assert(lastSent().body.includes('1️⃣'), 'video -> asks choice');
  await handleMessage({ from: user, type: 'text', text: { body: '1' } });
  st = lastSent();
  assert(st.kind === 'sticker' && st.pages > 1 && st.size < 500 * 1024,
    `video full -> animated sticker <500KB (pages=${st.pages}, ${st.size}b)`);

  // 6. /fig + video -> "2" trim -> "1 2" -> animated sticker
  await handleMessage({ from: user, type: 'text', text: { body: '/fig' } });
  pendingMediaFile = media.mp4;
  await handleMessage({ from: user, type: 'video', video: { id: 'm4' } });
  await handleMessage({ from: user, type: 'text', text: { body: '2' } });
  assert(lastSent().body.includes('inicio duracao'), 'trim -> asks start/duration');
  await handleMessage({ from: user, type: 'text', text: { body: '1 2' } });
  st = lastSent();
  assert(st.kind === 'sticker' && st.pages > 1, `video trim -> animated sticker (pages=${st.pages}, ${st.size}b)`);

  // 7. /fig + wrong type -> friendly error + reset
  await handleMessage({ from: user, type: 'text', text: { body: '/fig' } });
  await handleMessage({ from: user, type: 'audio', audio: { id: 'm5' } });
  assert(lastSent().body.includes('não parece'), 'wrong type -> friendly error');

  // 8. uploads dir must be empty (no temp accumulation)
  const leftovers = fs.readdirSync(uploadDir);
  assert(leftovers.length === 0, `uploads empty after all flows (found: ${leftovers.join(', ') || 'none'})`);

  // cleanup test media
  fs.rmSync(media.dir, { recursive: true, force: true });
  console.log(process.exitCode ? '\n❌ SOME TESTS FAILED' : '\n✅ ALL TESTS PASSED');
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
