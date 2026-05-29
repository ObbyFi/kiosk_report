const express = require('express');
const db = require('../database');

const router = express.Router();

// ─── List all master kiosks ────────────────────────────────────────
router.get('/master/kiosks', (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const result = db.getAllKiosks(search, parseInt(page), parseInt(limit));
    res.json(result);
  } catch (err) {
    console.error('Get kiosks error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Get single kiosk ──────────────────────────────────────────────
router.get('/master/kiosks/:id', (req, res) => {
  try {
    const kiosk = db.getKioskById.get(parseInt(req.params.id));
    if (!kiosk) {
      return res.status(404).json({ error: 'Kiosk not found' });
    }
    res.json(kiosk);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Update kiosk ──────────────────────────────────────────────────
router.put('/master/kiosks/:id', (req, res) => {
  try {
    const { name, store_name, created_date } = req.body;
    const id = parseInt(req.params.id);

    const existing = db.getKioskById.get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Kiosk not found' });
    }

    db.updateKiosk.run(
      name || existing.name,
      store_name || existing.store_name,
      created_date || existing.created_date,
      id
    );

    res.json({
      success: true,
      message: 'Kiosk updated successfully',
      kiosk: db.getKioskById.get(id)
    });
  } catch (err) {
    console.error('Update kiosk error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Delete single kiosk ───────────────────────────────────────────
router.delete('/master/kiosks/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = db.getKioskById.get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Kiosk not found' });
    }

    db.deleteKiosk.run(id);
    res.json({
      success: true,
      message: `Kiosk "${existing.name}" deleted`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Delete ALL kiosks ─────────────────────────────────────────────
router.post('/master/kiosks/delete-all', (req, res) => {
  try {
    const count = db.getKioskCount.get().count;
    db.deleteAllKiosks.run();
    res.json({
      success: true,
      message: `All ${count} kiosks deleted`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Master Kiosk All (Keseluruhan) ───────────────────────────────

router.get('/master/all-kiosks', (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const result = db.getAllMasterKiosks(search, parseInt(page), parseInt(limit));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/master/all-kiosks/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = db.getMasterKioskById.get(id);
    if (!existing) return res.status(404).json({ error: 'Kiosk not found' });
    db.deleteMasterKiosk.run(id);
    res.json({ success: true, message: `Kiosk "${existing.name}" deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/master/all-kiosks/delete-all', (req, res) => {
  try {
    const count = db.getMasterKioskCount.get().count;
    db.deleteAllMasterKiosks.run();
    res.json({ success: true, message: `All ${count} kiosks deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Re-classify a specific batch ──────────────────────────────────
router.post('/master/reclassify/:batchId', (req, res) => {
  try {
    const result = db.reclassifyBatch(req.params.batchId);
    res.json({
      success: true,
      message: `Re-classified ${result.total} orders`,
      stats: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
