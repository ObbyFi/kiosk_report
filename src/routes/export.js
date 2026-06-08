const express = require('express');
const db = require('../database');

const router = express.Router();

// ─── Export orders as CSV ──────────────────────────────────────────
router.get('/export/orders', (req, res) => {
  try {
    const { month, billing_type, store_name, kiosk_name, order_number } = req.query;
    const orders = db.getAllOrdersFiltered({ month, billing_type, store_name, kiosk_name, order_number });

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

// ─── Export store-kiosk report as Excel ───────────────────────────
router.get('/export/store-kiosk-report', (req, res) => {
  try {
    const { month } = req.query;
    const rows = db.getStoreKioskReport(month || null);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No data to export' });
    }

    // Group by store
    const stores = {};
    for (const row of rows) {
      if (!stores[row.store_name]) stores[row.store_name] = [];
      stores[row.store_name].push(row);
    }

    const totalKiosks = db.getMasterKioskCount.get().count;
    const totalNew = rows.filter(r => r.is_new).length;
    const totalActive = rows.filter(r => r.is_active).length;
    const periodLabel = month
      ? new Date(month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      : 'Semua Periode';

    let tableRows = '';
    for (const [storeName, kiosks] of Object.entries(stores).sort()) {
      kiosks.forEach((k, idx) => {
        const badges = [];
        if (k.is_new) badges.push('NEW');
        if (k.is_active) badges.push('ACTIVE');
        else badges.push('NO TRANSACTION');
        if (k.is_unregistered) badges.push('UNREGISTERED');
        tableRows += `
          <tr>
            ${idx === 0 ? `<td rowspan="${kiosks.length}" style="vertical-align:top;font-weight:bold;background:#f8fafc;">${storeName}</td>` : ''}
            <td>${k.kiosk_name}</td>
            <td>${badges.join(', ')}</td>
          </tr>`;
      });
    }

    const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 10pt; }
    h2 { font-size: 13pt; color: #0f172a; margin-bottom: 4px; }
    .sub { font-size: 9pt; color: #64748b; margin-bottom: 16px; }
    .summary { margin-bottom: 16px; font-size: 10pt; }
    .summary td { padding: 3px 12px 3px 0; }
    table.data { border-collapse: collapse; width: 100%; }
    table.data th { background: #1e293b; color: #fff; padding: 8px 12px; text-align: left; font-size: 10pt; border: 1px solid #cbd5e1; }
    table.data td { padding: 7px 12px; border: 1px solid #e2e8f0; font-size: 10pt; }
    table.data tr:nth-child(even) td { background: #f8fafc; }
    .badge-new { color: #b45309; font-weight: 600; }
    .badge-active { color: #065f46; font-weight: 600; }
  </style>
</head>
<body>
  <h2>Rekap Store &amp; Kiosk</h2>
  <div class="sub">Periode: ${periodLabel}</div>
  <table class="summary">
    <tr><td>Total Kiosk</td><td><strong>${totalKiosks}</strong></td></tr>
    <tr><td>Kiosk Baru (NEW)</td><td><strong>${totalNew}</strong></td></tr>
    <tr><td>Kiosk Aktif</td><td><strong>${totalActive}</strong></td></tr>
    <tr><td>Jumlah Store</td><td><strong>${Object.keys(stores).length}</strong></td></tr>
  </table>
  <table class="data">
    <thead>
      <tr>
        <th style="width:220px;">Store</th>
        <th style="width:220px;">Kiosk</th>
        <th style="width:140px;">Status</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;

    const filename = `rekap_kiosk_${month || 'all'}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
  } catch (err) {
    console.error('Export store kiosk report error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
