const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ─────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API Routes ────────────────────────────────────────────────────
const uploadRoutes = require('./routes/upload');
const masterRoutes = require('./routes/master');
const dashboardRoutes = require('./routes/dashboard');
const exportRoutes = require('./routes/export');

app.use('/api', uploadRoutes);
app.use('/api', masterRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', exportRoutes);

// ─── Error handling ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start Server ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🏪 Kiosk Billing Dashboard`);
  console.log(`  ──────────────────────────`);
  console.log(`  Server running at: http://localhost:${PORT}`);
  console.log(`  Press Ctrl+C to stop\n`);
});

module.exports = app;
