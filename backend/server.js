const express = require('express');
require('./database'); // Initialize database
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/messages', require('./routes/messages'));

// Static files
app.use('/uploads', express.static('uploads'));

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'KEDI Marketplace API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      orders: '/api/orders',
      messages: '/api/messages',
      payments: '/api/payments',
      admin: '/api/admin',
      uploads: '/api/uploads',
      health: '/api/health'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;

// Start server (database sync happens in database.js)
setTimeout(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}, 2000); // Give database time to sync