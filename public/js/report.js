// ─── Report State ────────────────────────────────────────────────────
let reportData = [];       // raw rows from API
let reportFiltered = [];   // after search filter
let reportMasterTotal = 0; // total kiosk di master_kiosks (termasuk non-active)

// ─── Load Report ─────────────────────────────────────────────────────
async function loadReport() {
  const month = document.getElementById('report-month')?.value || '';
  const container = document.getElementById('report-table-container');
  const countEl = document.getElementById('report-count');
  const statsEl = document.getElementById('report-stats');

  if (!container) return;

  container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Loading...</div>';
  if (countEl) countEl.textContent = 'Loading...';

  try {
    const res = await api(`/api/dashboard/store-kiosk-report${month ? `?month=${month}` : ''}`);
    reportData = res.rows;
    reportMasterTotal = res.master_total;
    applyReportSearch();
  } catch (err) {
    container.innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--text-muted);">
        <div style="font-size:2rem;margin-bottom:8px;">⚠️</div>
        <p>Gagal memuat data: ${err.message}</p>
      </div>`;
    if (countEl) countEl.textContent = '';
  }
}

// ─── Apply Search Filter & Re-render ─────────────────────────────────
function applyReportSearch() {
  const q = (document.getElementById('report-search')?.value || '').toLowerCase().trim();

  if (!q) {
    reportFiltered = reportData;
  } else {
    reportFiltered = reportData.filter(r =>
      r.store_name.toLowerCase().includes(q) ||
      r.kiosk_name.toLowerCase().includes(q)
    );
  }

  renderReportTable();
}

// ─── Render Table ─────────────────────────────────────────────────────
function renderReportTable() {
  const container = document.getElementById('report-table-container');
  const countEl = document.getElementById('report-count');
  const statsEl = document.getElementById('report-stats');
  if (!container) return;

  if (reportFiltered.length === 0) {
    container.innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--text-muted);">
        <div style="font-size:2rem;margin-bottom:8px;">🏪</div>
        <h3 style="margin-bottom:8px;">Tidak ada data</h3>
        <p>Upload master kiosk keseluruhan dan data transaksi untuk melihat rekap ini.</p>
      </div>`;
    if (countEl) countEl.textContent = '';
    if (statsEl) statsEl.innerHTML = '';
    return;
  }

  // Stats
  const totalNew = reportFiltered.filter(r => r.is_new).length;
  const totalActive = reportFiltered.filter(r => r.is_active).length;
  const storeSet = new Set(reportFiltered.map(r => r.store_name));
  const displayTotal = reportMasterTotal || reportFiltered.length;

  if (countEl) countEl.textContent = `${formatNumber(displayTotal)} kiosk terdaftar • ${formatNumber(storeSet.size)} store`;

  if (statsEl) {
    statsEl.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:10px 18px;">
        <div style="font-size:0.75rem;color:var(--text-muted);">Total Kiosk</div>
        <div style="font-size:1.4rem;font-weight:700;color:var(--text-primary);">${formatNumber(displayTotal)}</div>
      </div>
      <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:10px 18px;">
        <div style="font-size:0.75rem;color:var(--text-muted);">Kiosk Baru</div>
        <div style="font-size:1.4rem;font-weight:700;color:#f59e0b;">${formatNumber(totalNew)}</div>
      </div>
      <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:10px 18px;">
        <div style="font-size:0.75rem;color:var(--text-muted);">Kiosk Aktif</div>
        <div style="font-size:1.4rem;font-weight:700;color:#10b981;">${formatNumber(totalActive)}</div>
      </div>
      <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:10px 18px;">
        <div style="font-size:0.75rem;color:var(--text-muted);">Jumlah Store</div>
        <div style="font-size:1.4rem;font-weight:700;color:var(--accent-blue);">${formatNumber(storeSet.size)}</div>
      </div>
    `;
  }

  // Group by store
  const stores = {};
  for (const row of reportFiltered) {
    if (!stores[row.store_name]) stores[row.store_name] = [];
    stores[row.store_name].push(row);
  }

  let tableRows = '';
  for (const storeName of Object.keys(stores).sort()) {
    const kiosks = stores[storeName];
    kiosks.forEach((k, idx) => {
      tableRows += `
        <tr>
          ${idx === 0
            ? `<td rowspan="${kiosks.length}" style="vertical-align:top;font-weight:600;padding-top:12px;border-right:1px solid var(--border-color);">${storeName}</td>`
            : ''}
          <td>${k.kiosk_name}${k.is_unregistered
            ? ' <span title="Tidak terdaftar di master kiosk" style="color:var(--text-muted);font-size:0.72rem;cursor:help;">✦</span>'
            : ''}</td>
          <td style="white-space:nowrap;">
            ${k.is_new
              ? '<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-size:0.7rem;padding:2px 8px;margin-right:4px;">NEW</span>'
              : ''}
            ${k.is_active
              ? '<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);font-size:0.7rem;padding:2px 8px;margin-right:4px;">ACTIVE</span>'
              : ''}
            ${k.has_no_transactions
              ? '<span class="badge" style="background:rgba(100,116,139,0.15);color:#94a3b8;border:1px solid rgba(100,116,139,0.3);font-size:0.7rem;padding:2px 8px;">NO TRX</span>'
              : ''}
          </td>
        </tr>`;
    });
  }

  container.innerHTML = `
    <div style="overflow-x:auto;max-height:600px;overflow-y:auto;">
      <table class="data-table" style="margin-top:0;">
        <thead>
          <tr style="position:sticky;top:0;z-index:1;background:#1a2237;">
            <th style="min-width:180px;">Store</th>
            <th>Kiosk</th>
            <th style="min-width:150px;">Status</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <div style="padding:8px 20px;font-size:0.75rem;color:var(--text-muted);">
      ✦ Kiosk aktif yang tidak terdaftar di master kiosk keseluruhan
    </div>`;
}

// ─── Handlers ────────────────────────────────────────────────────────
function onReportMonthChange() {
  loadReport();
}

let reportSearchTimeout;
function onReportSearch() {
  clearTimeout(reportSearchTimeout);
  reportSearchTimeout = setTimeout(applyReportSearch, 300);
}

function exportReportExcel() {
  const month = document.getElementById('report-month')?.value || '';
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  window.open(`/api/export/store-kiosk-report?${params}`, '_blank');
}
