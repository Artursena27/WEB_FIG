const express = require('express');
const cors = require('cors');
const path = require('path');
const stickerRoutes = require('./routes/stickerRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve uploads directory if we want to preview via URL (optional)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/stickers', stickerRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
