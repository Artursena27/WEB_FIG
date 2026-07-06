const sharp = require('sharp');
const fs = require('fs');

// WhatsApp sticker limits (Cloud API)
const STATIC_MAX_BYTES = 100 * 1024;   // 100KB for static stickers
const ANIMATED_MAX_BYTES = 500 * 1024; // 500KB for animated stickers

/**
 * Converts an image (static or animated GIF) to WhatsApp sticker format:
 * WebP, 512x512, transparent padding. Retries with lower quality if the
 * output exceeds the size limit.
 */
async function processImage(inputPath, outputPath) {
  // Read into a buffer so sharp never holds a handle on the input file
  // (on Windows that would break the unlink cleanup with EBUSY)
  const input = fs.readFileSync(inputPath);
  const meta = await sharp(input, { animated: true }).metadata();
  const isAnimated = (meta.pages || 1) > 1;
  const maxBytes = isAnimated ? ANIMATED_MAX_BYTES : STATIC_MAX_BYTES;

  const qualities = [80, 60, 40, 25];
  let buffer;

  for (const quality of qualities) {
    buffer = await sharp(input, { animated: true })
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality, effort: 6 })
      .toBuffer();

    if (buffer.length <= maxBytes) break;
    console.log(`Sticker too big at quality ${quality} (${buffer.length} bytes), retrying...`);
  }

  fs.writeFileSync(outputPath, buffer);
  console.log(`Image processed (${isAnimated ? 'animated' : 'static'}, ${buffer.length} bytes) -> ${outputPath}`);
  return { isAnimated, size: buffer.length };
}

module.exports = {
  processImage
};
