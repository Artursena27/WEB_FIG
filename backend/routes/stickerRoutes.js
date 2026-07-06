const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { processImage } = require('../services/imageProcessor');
const { processVideo } = require('../services/videoProcessor');

// Configure multer for temp storage
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

router.post('/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { path: inputPath, mimetype, originalname } = req.file;
    const { removeBackground = 'false' } = req.body;
    const shouldRemoveBg = removeBackground === 'true';

    const outputPath = path.join(uploadDir, `sticker_${Date.now()}.webp`);
    
    let isAnimated = false;
    let size = 0;

    console.log(`Processing file: ${originalname} (${mimetype})`);

    // Determine type
    if (mimetype.startsWith('video/') || mimetype === 'image/gif') {
      // Process as animated sticker
      await processVideo(inputPath, outputPath);
      isAnimated = true;
    } else if (mimetype.startsWith('image/')) {
      // Process as static sticker
      await processImage(inputPath, outputPath, shouldRemoveBg);
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // Check final size
    const stat = fs.statSync(outputPath);
    size = stat.size;

    // Read the converted file to send as response
    const webpBuffer = fs.readFileSync(outputPath);

    // Clean up temporary files
    try {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (cleanupErr) {
      console.error('Error cleaning up files:', cleanupErr);
    }

    // Send the WebP file back
    res.set({
      'Content-Type': 'image/webp',
      'Content-Length': size,
      'Content-Disposition': `attachment; filename="sticker_${isAnimated ? 'animated' : 'static'}.webp"`,
      'X-Sticker-Animated': isAnimated,
      'X-Sticker-Size': size
    });
    
    res.send(webpBuffer);

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: 'Failed to process file', details: error.message });
  }
});

module.exports = router;
