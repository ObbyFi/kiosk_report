// ─── Transactions State ─────────────────────────────────────────────
let trxPage = 1;
let trxSearchTimeout;

// ─── Load Transactions ──────────────────────────────────────────────
async function loadTransactions(page = 1) {
  trxPage = page;

  const month = document.getElementById('trx-month')?.value || '';
  const billing_type = document.getElementById('trx-billing-type')?.value || '';
  const store_name = document.getElementById('trx-store')?.value || '';
  const order_number = document.getElementById('trx-order-number')?.value.trim() || '';
  const kiosk_name = document.getElementById('trx-kiosk-name')?.value.trim() || '';

  const params = new URLSearchParams({ page, limit: 25 });
  if (month) params.set('month', month);
  if (billing_type) params.set('billing_type', billing_type);
  if (store_name) params.set('store_name', store_name);
  if (order_number) params.set('order_number', order_number);
  if (kiosk_name) params.set('kiosk_name', kiosk_name);

  const tbody = document.getElementById('trx-tbody');
  const pagination = document.getElementById('trx-pagination');
  const countEl = document.getElementById('trx-count');

  if (!tbody) return;

  try {
    const data = await api(`/api/dashboard/orders?${params}`);

    if (countEl) countEl.textContent = `${formatNumber(data.total)} transaksi`;

    if (data.rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">
            Tidak ada transaksi yang cocok dengan filter yang dipilih
          </td>
        </tr>`;
      if (pagination) pagination.innerHTML = '';
      return;
    }

    tbody.innerHTML = data.rows.map(row => `
      <tr>
        <td>${formatDate(row.order_date)}</td>
        <td style="font-family:monospace;font-size:0.85rem;">${row.order_number || '-'}</td>
        <td>${row.store_name || '-'}</td>
        <td>${row.kiosk_name || '-'}</td>
        <td>${billingBadge(row.billing_type)}</td>
      </tr>
    `).join('');

    if (pagination) createPagination(pagination, data.total, data.page, data.limit, changeTrxPage);
  } catch (err) {
    console.error('Load transactions error:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">
          Gagal memuat data transaksi
        </td>
      </tr>`;
  }
}

function changeTrxPage(page) {
  loadTransactions(page);
}

function onTrxFilterChange() {
  loadTransactions(1);
}

function onTrxSearchInput() {
  clearTimeout(trxSearchTimeout);
  trxSearchTimeout = setTimeout(() => loadTransactions(1), 400);
}

function exportTransactions() {
  const month = document.getElementById('trx-month')?.value || '';
  const billing_type = document.getElementById('trx-billing-type')?.value || '';
  const store_name = document.getElementById('trx-store')?.value || '';
  const order_number = document.getElementById('trx-order-number')?.value.trim() || '';
  const kiosk_name = document.getElementById('trx-kiosk-name')?.value.trim() || '';

  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (billing_type) params.set('billing_type', billing_type);
  if (store_name) params.set('store_name', store_name);
  if (order_number) params.set('order_number', order_number);
  if (kiosk_name) params.set('kiosk_name', kiosk_name);

  window.open(`/api/export/orders?${params}`);
}
