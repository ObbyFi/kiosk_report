// ─── Dashboard State ────────────────────────────────────────────────
let dashboardPage = 1;
let chartInstance = null;

// ─── Load Dashboard ─────────────────────────────────────────────────
async function loadDashboard() {
  const month = document.getElementById('dashboard-month')?.value || '';
  await Promise.all([
    loadSummaryCards(month),
    loadOrdersTable(month),
    loadBillingSummary(month),
    loadStoreKioskRecap(month)
  ]);
}

// ─── Summary Cards ──────────────────────────────────────────────────
async function loadSummaryCards(month) {
  try {
    const summary = await api(`/api/dashboard/summary${month ? `?month=${month}` : ''}`);
    const container = document.getElementById('summary-cards');
    container.innerHTML = `
      <div class="summary-card blue">
        <div class="card-header">
          <span class="card-label">Total Orders</span>
          <span class="card-icon">📦</span>
        </div>
        <div class="card-value blue">${formatNumber(summary.total_orders)}</div>
        <div class="card-sub">${month ? formatMonthLabel(month) : 'All time'}</div>
      </div>
      <div class="summary-card amber">
        <div class="card-header">
          <span class="card-label">Active Stores</span>
          <span class="card-icon">📍</span>
        </div>
        <div class="card-value amber">${formatNumber(summary.active_stores)}</div>
        <div class="card-sub">Stores with orders</div>
      </div>
      <div class="summary-card cyan">
        <div class="card-header">
          <span class="card-label">Active New Kiosks</span>
          <span class="card-icon">📱</span>
        </div>
        <div class="card-value cyan">${formatNumber(summary.active_new_kiosks)}</div>
        <div class="card-sub">of ${formatNumber(summary.master_kiosk_count)} registered</div>
      </div>
    `;
  } catch (err) {
    console.error('Load summary error:', err);
  }
}

// ─── Monthly Trend Chart ────────────────────────────────────────────
async function loadMonthlyChart() {
  try {
    const trend = await api('/api/dashboard/monthly-trend');
    const canvas = document.getElementById('monthly-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (chartInstance) {
      chartInstance.destroy();
    }

    if (trend.length === 0) {
      const wrapper = canvas.parentElement;
      wrapper.innerHTML = `
        <div class="empty-state" style="padding: 40px;">
          <div class="empty-icon">📊</div>
          <h3>No data yet</h3>
          <p>Upload order data to see monthly trends</p>
        </div>
      `;
      return;
    }

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: trend.map(t => formatMonthLabel(t.month)),
        datasets: [
          {
            label: 'Per-Store',
            data: trend.map(t => t.per_store),
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Per-Unit',
            data: trend.map(t => t.per_unit),
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
            borderRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: 'Inter', size: 12 },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 20,
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleFont: { family: 'Inter', weight: '600' },
            bodyFont: { family: 'Inter' },
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw)} orders`
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
            grid: { display: false },
            border: { color: 'rgba(255,255,255,0.06)' }
          },
          y: {
            stacked: true,
            ticks: {
              color: '#64748b',
              font: { family: 'Inter', size: 11 },
              callback: (v) => formatNumber(v)
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
            border: { display: false }
          }
        }
      }
    });
  } catch (err) {
    console.error('Load chart error:', err);
  }
}

// ─── Orders Table ───────────────────────────────────────────────────
async function loadOrdersTable(month, page = 1) {
  dashboardPage = page;
  const billingType = document.getElementById('filter-billing-type')?.value || '';
  const storeName = document.getElementById('filter-store')?.value || '';
  const search = document.getElementById('filter-search')?.value || '';

  try {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (billingType) params.set('billing_type', billingType);
    if (storeName) params.set('store_name', storeName);
    if (search) params.set('search', search);
    params.set('page', page);
    params.set('limit', 25);

    const data = await api(`/api/dashboard/orders?${params}`);
    const tbody = document.getElementById('orders-tbody');
    const pagination = document.getElementById('orders-pagination');

    if (data.rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No orders found for the selected filters
          </td>
        </tr>
      `;
      pagination.innerHTML = '';
      return;
    }

    tbody.innerHTML = data.rows.map(order => `
      <tr>
        <td>${formatDate(order.order_date)}</td>
        <td style="font-family: monospace; font-size: 0.8rem;">${order.order_number}</td>
        <td>${order.store_name}</td>
        <td><strong>${order.kiosk_name}</strong></td>
        <td>${billingBadge(order.billing_type)}</td>
      </tr>
    `).join('');

    createPagination(pagination, data.total, data.page, data.limit, changeOrderPage);
  } catch (err) {
    console.error('Load orders error:', err);
  }
}

function changeOrderPage(page) {
  const month = document.getElementById('dashboard-month')?.value || '';
  loadOrdersTable(month, page);
}

// ─── Billing Summary ────────────────────────────────────────────────
async function loadBillingSummary(month) {
  try {
    const data = await api(`/api/dashboard/billing-summary${month ? `?month=${month}` : ''}`);
    const container = document.getElementById('billing-summary');
    if (!container) return;

    const totalStoreKiosks = data.per_store.reduce((sum, s) => sum + s.kiosk_count, 0);

    container.innerHTML = `
      <div class="billing-card">
        <div class="billing-card-title">
          <span class="badge badge-store"><span class="badge-dot"></span>PER STORE</span>
          Billing Summary
        </div>
        <div style="display: flex; gap: 40px; margin-bottom: 12px; flex-wrap: wrap;">
          <div>
            <div class="billing-stat" style="color: var(--accent-emerald); margin-bottom: 0;">${formatNumber(data.per_store_total_stores)}</div>
            <div class="billing-stat-label">Active stores to bill</div>
          </div>
          <div>
            <div class="billing-stat" style="color: var(--accent-cyan); margin-bottom: 0;">${formatNumber(totalStoreKiosks)}</div>
            <div class="billing-stat-label">Total active kiosks</div>
          </div>
        </div>
        ${data.per_store.length > 0 ? `
          <div style="max-height: 400px; overflow-y: auto; margin-top: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
            <table class="data-table" style="margin-top: 0;">
              <thead>
                <tr style="position: sticky; top: 0; z-index: 1; background: #1a2237;">
                  <th>Store</th>
                  <th>Kiosks</th>
                </tr>
              </thead>
              <tbody>
                ${data.per_store.map(s => `
                  <tr>
                    <td>${s.store_name}</td>
                    <td>${s.kiosk_count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 12px;">No per-store orders</p>'}
      </div>

      <div class="billing-card">
        <div class="billing-card-title">
          <span class="badge badge-unit"><span class="badge-dot"></span>PER UNIT</span>
          Billing Summary
        </div>
        <div class="billing-stat" style="color: var(--accent-blue);">${formatNumber(data.per_unit_total_kiosks)}</div>
        <div class="billing-stat-label">Active kiosk units to bill</div>
        ${data.per_unit.length > 0 ? `
          <div style="max-height: 400px; overflow-y: auto; margin-top: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
            <table class="data-table" style="margin-top: 0;">
              <thead>
                <tr style="position: sticky; top: 0; z-index: 1; background: #1a2237;">
                  <th>Kiosk</th>
                  <th>Store</th>
                </tr>
              </thead>
              <tbody>
                ${data.per_unit.map(u => `
                  <tr>
                    <td><strong>${u.kiosk_name}</strong></td>
                    <td>${u.store_name}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 12px;">No per-unit orders</p>'}
      </div>
    `;
  } catch (err) {
    console.error('Load billing summary error:', err);
  }
}

// ─── Store Kiosk Recap ──────────────────────────────────────────────
async function loadStoreKioskRecap(month) {
  try {
    const tbody = document.getElementById('recap-store-tbody');
    const totalEl = document.getElementById('recap-total-kiosks');
    if (!tbody) return;

    const recap = await api(`/api/dashboard/store-recap${month ? `?month=${month}` : ''}`);
    
    if (recap.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; padding: 30px; color: var(--text-muted);">
            No store data found. Please upload master kiosks and order data.
          </td>
        </tr>
      `;
      if (totalEl) totalEl.textContent = '0';
      return;
    }
    
    let totalActiveKiosks = 0;
    
    tbody.innerHTML = recap.map((row, idx) => {
      totalActiveKiosks += row.active_kiosks;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${row.store_name}</td>
          <td><strong>${row.active_kiosks}</strong></td>
        </tr>
      `;
    }).join('');
    
    if (totalEl) {
      totalEl.textContent = formatNumber(totalActiveKiosks);
    }
  } catch (err) {
    console.error('Load store kiosk recap error:', err);
  }
}

// ─── Store Kiosk Report ─────────────────────────────────────────────
async function loadStoreKioskReport(month) {
  const container = document.getElementById('store-kiosk-report');
  if (!container) return;

  try {
    const rows = await api(`/api/dashboard/store-kiosk-report${month ? `?month=${month}` : ''}`);

    if (rows.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 40px; text-align: center;">
          <div class="empty-icon">🏪</div>
          <h3>Belum ada data</h3>
          <p>Upload master kiosk keseluruhan dan data order untuk melihat rekap ini.</p>
        </div>
      `;
      return;
    }

    // Group by store
    const stores = {};
    for (const row of rows) {
      if (!stores[row.store_name]) stores[row.store_name] = [];
      stores[row.store_name].push(row);
    }

    const storeNames = Object.keys(stores).sort();
    let totalKiosks = rows.length;
    let totalNew = rows.filter(r => r.is_new).length;
    let totalActive = rows.filter(r => r.is_active).length;

    let tableRows = '';
    for (const storeName of storeNames) {
      const kiosks = stores[storeName];
      kiosks.forEach((k, idx) => {
        tableRows += `
          <tr>
            ${idx === 0 ? `<td rowspan="${kiosks.length}" style="vertical-align: top; font-weight: 600; border-right: 1px solid var(--border-color); padding-top: 12px;">${storeName}</td>` : ''}
            <td>${k.kiosk_name}${k.is_unregistered ? ' <span title="Tidak terdaftar di master" style="color:var(--text-muted);font-size:0.75rem;">✦</span>' : ''}</td>
            <td style="white-space: nowrap;">
              ${k.is_new ? '<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-size:0.7rem;padding:2px 8px;">NEW</span> ' : ''}
              ${k.is_active ? '<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);font-size:0.7rem;padding:2px 8px;">ACTIVE</span>' : ''}
            </td>
          </tr>
        `;
      });
    }

    container.innerHTML = `
      <div style="display:flex;gap:24px;padding:16px 20px;border-bottom:1px solid var(--border-color);flex-wrap:wrap;">
        <div><span style="color:var(--text-muted);font-size:0.8rem;">Total Kiosk</span><div style="font-size:1.3rem;font-weight:700;color:var(--text-primary);">${formatNumber(totalKiosks)}</div></div>
        <div><span style="color:var(--text-muted);font-size:0.8rem;">Kiosk Baru (NEW)</span><div style="font-size:1.3rem;font-weight:700;color:#f59e0b;">${formatNumber(totalNew)}</div></div>
        <div><span style="color:var(--text-muted);font-size:0.8rem;">Kiosk Aktif</span><div style="font-size:1.3rem;font-weight:700;color:#10b981;">${formatNumber(totalActive)}</div></div>
        <div><span style="color:var(--text-muted);font-size:0.8rem;">Jumlah Store</span><div style="font-size:1.3rem;font-weight:700;color:var(--accent-blue);">${formatNumber(storeNames.length)}</div></div>
      </div>
      <div style="overflow-x:auto;max-height:500px;overflow-y:auto;">
        <table class="data-table" style="margin-top:0;">
          <thead>
            <tr style="position:sticky;top:0;z-index:1;background:#1a2237;">
              <th style="min-width:160px;">Store</th>
              <th>Kiosk</th>
              <th style="min-width:140px;">Status</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div style="padding:10px 20px;font-size:0.75rem;color:var(--text-muted);">
        ✦ Kiosk aktif yang tidak terdaftar di master kiosk keseluruhan
      </div>
    `;
  } catch (err) {
    console.error('Load store kiosk report error:', err);
  }
}

// ─── Dashboard Filter Handlers ──────────────────────────────────────
function onDashboardMonthChange() {
  const month = document.getElementById('dashboard-month').value;
  AppState.selectedMonth = month;
  loadDashboard();
}

function onFilterChange() {
  const month = document.getElementById('dashboard-month')?.value || '';
  loadOrdersTable(month, 1);
}

// Debounce search input
let searchTimeout;
function onSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => onFilterChange(), 400);
}

// ─── Export Functions ───────────────────────────────────────────────
function exportOrders() {
  const month = document.getElementById('dashboard-month')?.value || '';
  const billingType = document.getElementById('filter-billing-type')?.value || '';
  const storeName = document.getElementById('filter-store')?.value || '';

  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (billingType) params.set('billing_type', billingType);
  if (storeName) params.set('store_name', storeName);

  window.open(`/api/export/orders?${params}`, '_blank');
}

function exportBillingSummary() {
  const month = document.getElementById('dashboard-month')?.value || '';
  const params = new URLSearchParams();
  if (month) params.set('month', month);

  window.open(`/api/export/billing-summary?${params}`, '_blank');
}
