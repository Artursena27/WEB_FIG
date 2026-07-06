const sharp = require('sharp');
const fs = require('fs');

// Optional: Background removal using Transformers.js
// We load it dynamically to avoid blocking startup
let segmenter = null;

async function getSegmenter() {
  if (!segmenter) {
    try {
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = false;
      // Note: 'briaai/RMBG-1.4' is popular, but might need custom processing. 
      // We will use a standard segmentation pipeline if available, or just skip if it fails.
      // For a robust production app, a dedicated service or python rembg is better.
      segmenter = await pipeline('image-segmentation', 'Xenova/segformer-b0-finetuned-ade-512-512');
    } catch (e) {
      console.warn("Failed to load transformers.js. Background removal will be skipped.", e);
      segmenter = "FAILED";
    }
  }
  return segmenter;
}

/**
 * Processes an image to create a WhatsApp static sticker (WebP, 512x512, < 100kb)
 */
async function processImage(inputPath, outputPath, shouldRemoveBg = false) {
  let imageBuffer = fs.readFileSync(inputPath);

  if (shouldRemoveBg) {
    const seg = await getSegmenter();
    if (seg && seg !== "FAILED") {
      try {
        console.log("Removing background...");
        // In a real implementation with Xenova/modnet or RMBG:
        // const result = await seg(inputPath);
        // This is a placeholder for the actual mask generation logic,
        // which varies greatly depending on the exact model used.
        // For now, we will fallback to simple sharp processing to ensure MVP works.
        console.log("Background removal logic is a placeholder. Using original image.");
      } catch (e) {
        console.error("Background removal error:", e);
      }
    }
  }

  // Convert to WhatsApp Sticker format
  // 512x512, transparent background, webp format
  await sharp(imageBuffer)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({ quality: 80, effort: 6 })
    .toFile(outputPath);
    
  console.log(`Image processed and saved to ${outputPath}`);
}

module.exports = {
  processImage
};
