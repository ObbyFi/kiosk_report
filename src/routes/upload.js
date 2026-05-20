const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { parseMasterKioskCSV, parseOrderDataCSV } = require('../utils/csv-parser');
const db = require('../database');

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// ─── Upload Master Kiosk CSV ───────────────────────────────────────
router.post('/upload/master-kiosk', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const content = req.file.buffer.toString('utf-8');
    const { data, errors } = parseMasterKioskCSV(content);

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'CSV validation errors',
        details: errors.slice(0, 10) // Show first 10 errors
      });
    }

    if (data.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Insert into database
    const inserted = db.insertKioskBatch(data);

    // Log the upload
    const batchId = uuidv4();
    db.insertUpload.run(batchId, req.file.originalname, 'MASTER_KIOSK', inserted, 0);

    res.json({
      success: true,
      message: `Successfully uploaded master kiosk data`,
      stats: {
        total_rows: data.length,
        inserted_or_updated: inserted,
        file_name: req.file.originalname
      }
    });
  } catch (err) {
    console.error('Upload master kiosk error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Upload Order Data CSV ─────────────────────────────────────────
router.post('/upload/order-data', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const content = req.file.buffer.toString('utf-8');
    const { data, errors } = parseOrderDataCSV(content);

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'CSV validation errors',
        details: errors.slice(0, 10)
      });
    }

    if (data.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Insert with auto-classification
    const batchId = uuidv4();
    const { inserted, duplicates } = db.insertOrderBatch(data, batchId);

    // Log the upload
    db.insertUpload.run(batchId, req.file.originalname, 'ORDER_DATA', inserted, duplicates);

    // Count classification breakdown
    const perUnit = data.filter(o => {
      // Re-check against DB for accurate count
      return true; // Will be counted from DB
    });

    // Get actual counts from DB for this batch
    const batchStats = db.db.prepare(`
      SELECT 
        billing_type,
        COUNT(*) as count
      FROM orders 
      WHERE upload_batch = ?
      GROUP BY billing_type
    `).all(batchId);

    const breakdown = {};
    batchStats.forEach(s => { breakdown[s.billing_type] = s.count; });

    res.json({
      success: true,
      message: `Successfully uploaded order data`,
      stats: {
        total_rows: data.length,
        inserted: inserted,
        duplicates: duplicates,
        per_store: breakdown['PER_STORE'] || 0,
        per_unit: breakdown['PER_UNIT'] || 0,
        batch_id: batchId,
        file_name: req.file.originalname
      }
    });
  } catch (err) {
    console.error('Upload order data error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
