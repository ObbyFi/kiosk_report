const express = require('express');
const db = require('../database');

const router = express.Router();

// ─── Export orders as CSV ──────────────────────────────────────────
router.get('/export/orders', (req, res) => {
  try {
    const { month, billing_type, store_name, kiosk_name } = req.query;
    const orders = db.getAllOrdersFiltered({ month, billing_type, store_name, kiosk_name });

    // Build CSV
    const headers = ['order_date', 'order_number', 'store_name', 'kiosk_name', 'billing_type'];
    const csvRows = [headers.join(',')];

    for (const order of orders) {
      const row = headers.map(h => {
        const val = order[h] || '';
        // Escape commas and quotes
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');
    const filename = `orders_${billing_type || 'all'}_${month || 'all'}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('Export orders error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Export billing summary ────────────────────────────────────────
router.get('/export/billing-summary', (req, res) => {
  try {
    const { month } = req.query;
    const summary = db.getBillingSummary(month || null);
    const totalStoreKiosks = summary.per_store.reduce((sum, s) => sum + s.kiosk_count, 0);

    let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    h3 { font-size: 12pt; font-weight: bold; margin-top: 20px; margin-bottom: 8px; color: #0f172a; }
    table { border-collapse: collapse; margin-bottom: 24px; }
    th { background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: left; padding: 8px 12px; border: 1px solid #cbd5e1; font-size: 10pt; }
    td { padding: 8px 12px; border: 1px solid #cbd5e1; font-size: 10pt; }
    .total-store { background-color: #d1fae5; color: #065f46; font-weight: bold; }
    .total-unit { background-color: #dbeafe; color: #1e40af; font-weight: bold; }
  </style>
</head>
<body>
  <h3>=== PER STORE BILLING ===</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 250px;">Store Name</th>
        <th style="width: 120px;">Active Kiosks</th>
      </tr>
    </thead>
    <tbody>
      <tr class="total-store">
        <td class="total-store">Total: ${summary.per_store_total_stores} Stores</td>
        <td class="total-store">${totalStoreKiosks} Kiosks</td>
      </tr>
`;

    for (const s of summary.per_store) {
      html += `
      <tr>
        <td>${s.store_name}</td>
        <td>${s.kiosk_count}</td>
      </tr>`;
    }

    html += `
    </tbody>
  </table>

  <h3>=== PER UNIT BILLING ===</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 180px;">Kiosk Name</th>
        <th style="width: 250px;">Store Name</th>
      </tr>
    </thead>
    <tbody>
      <tr class="total-unit">
        <td class="total-unit">Total: ${summary.per_unit_total_kiosks} Kiosks</td>
        <td class="total-unit">Active Units</td>
      </tr>
`;

    for (const u of summary.per_unit) {
      html += `
      <tr>
        <td><strong>${u.kiosk_name}</strong></td>
        <td>${u.store_name}</td>
      </tr>`;
    }

    html += `
    </tbody>
  </table>
</body>
</html>
`;

    const filename = `billing_summary_${month || 'all'}.xls`;

    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
  } catch (err) {
    console.error('Export billing summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
