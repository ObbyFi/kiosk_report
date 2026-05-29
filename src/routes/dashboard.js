const express = require('express');
const db = require('../database');

const router = express.Router();

// ─── Summary cards ─────────────────────────────────────────────────
router.get('/dashboard/summary', (req, res) => {
  try {
    const { month } = req.query;
    const summary = db.getSummary(month || null);
    res.json(summary);
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Monthly trend for chart ───────────────────────────────────────
router.get('/dashboard/monthly-trend', (req, res) => {
  try {
    const trend = db.getMonthlyTrend();
    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Orders list (paginated + filtered) ────────────────────────────
router.get('/dashboard/orders', (req, res) => {
  try {
    const { month, billing_type, store_name, kiosk_name, order_number, search, page = 1, limit = 25 } = req.query;
    const result = db.getOrders({
      month, billing_type, store_name, kiosk_name, order_number, search,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Available months ──────────────────────────────────────────────
router.get('/dashboard/months', (req, res) => {
  try {
    const months = db.getAvailableMonths();
    res.json(months);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Store list ────────────────────────────────────────────────────
router.get('/dashboard/stores', (req, res) => {
  try {
    const stores = db.getStoreList();
    res.json(stores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Billing summary ──────────────────────────────────────────────
router.get('/dashboard/billing-summary', (req, res) => {
  try {
    const { month } = req.query;
    const summary = db.getBillingSummary(month || null);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Store Kiosk Report ───────────────────────────────────────────
router.get('/dashboard/store-kiosk-report', (req, res) => {
  try {
    const { month } = req.query;
    const rows = db.getStoreKioskReport(month || null);
    const masterTotal = db.getMasterKioskCount.get().count;
    res.json({ rows, master_total: masterTotal });
  } catch (err) {
    console.error('Store kiosk report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Upload batches ────────────────────────────────────────────────
router.get('/dashboard/uploads', (req, res) => {
  try {
    const uploads = db.getUploads();
    res.json(uploads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Delete order batch ────────────────────────────────────────────
router.delete('/dashboard/orders/batch/:batchId', (req, res) => {
  try {
    const batchId = req.params.batchId;
    db.deleteOrdersByBatch.run(batchId);
    db.deleteUploadByBatch.run(batchId);
    res.json({ success: true, message: `Batch ${batchId} deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
