// ─── App State ──────────────────────────────────────────────────────
const AppState = {
  currentTab: 'dashboard',
  selectedMonth: '',
  months: [],
  stores: [],
};

// ─── Tab Navigation ─────────────────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  AppState.currentTab = tabId;

  // Update tab buttons
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.nav-tab[data-tab="${tabId}"]`).classList.add('active');

  // Update content
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');

  // Load tab data
  if (tabId === 'dashboard') loadDashboard();
  if (tabId === 'upload') loadUploadHistory();
  if (tabId === 'master') loadMasterKiosks();
}

// ─── Toast Notifications ────────────────────────────────────────────
function showToast(type, title, message) {
  const container = document.getElementById('toast-container');
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── API Helper ─────────────────────────────────────────────────────
async function api(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API error');
    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

// ─── Utility Functions ──────────────────────────────────────────────
function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMonthLabel(monthStr) {
  if (!monthStr) return 'All Months';
  const [year, month] = monthStr.split('-');
  const date = new Date(year, parseInt(month) - 1);
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function billingBadge(type) {
  if (type === 'PER_UNIT') {
    return '<span class="badge badge-unit"><span class="badge-dot"></span>PER UNIT</span>';
  }
  return '<span class="badge badge-store"><span class="badge-dot"></span>PER STORE</span>';
}

function createPagination(container, total, page, limit, onPageChange) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) {
    container.innerHTML = `
      <span class="pagination-info">Showing ${total} of ${total} records</span>
      <div class="pagination-buttons"></div>
    `;
    return;
  }

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  let buttons = '';
  buttons += `<button class="page-btn" ${page === 1 ? 'disabled' : ''} onclick="(${onPageChange})(${page - 1})">‹</button>`;

  const maxVisible = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    buttons += `<button class="page-btn" onclick="(${onPageChange})(1)">1</button>`;
    if (startPage > 2) buttons += `<span style="color: var(--text-muted); padding: 0 4px;">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    buttons += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="(${onPageChange})(${i})">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) buttons += `<span style="color: var(--text-muted); padding: 0 4px;">...</span>`;
    buttons += `<button class="page-btn" onclick="(${onPageChange})(${totalPages})">${totalPages}</button>`;
  }

  buttons += `<button class="page-btn" ${page === totalPages ? 'disabled' : ''} onclick="(${onPageChange})(${page + 1})">›</button>`;

  container.innerHTML = `
    <span class="pagination-info">Showing ${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(total)}</span>
    <div class="pagination-buttons">${buttons}</div>
  `;
}

// ─── Load Available Months & Stores ─────────────────────────────────
async function loadFilters() {
  try {
    const [months, stores] = await Promise.all([
      api('/api/dashboard/months'),
      api('/api/dashboard/stores')
    ]);
    AppState.months = months;
    AppState.stores = stores;
    populateMonthSelectors();
    populateStoreSelectors();
  } catch (err) {
    console.error('Failed to load filters:', err);
  }
}

function populateMonthSelectors() {
  document.querySelectorAll('.month-select').forEach(select => {
    const currentValue = select.value;
    select.innerHTML = '<option value="">All Months</option>';
    AppState.months.forEach(m => {
      select.innerHTML += `<option value="${m}" ${m === currentValue ? 'selected' : ''}>${formatMonthLabel(m)}</option>`;
    });
  });
}

function populateStoreSelectors() {
  document.querySelectorAll('.store-select').forEach(select => {
    const currentValue = select.value;
    select.innerHTML = '<option value="">All Stores</option>';
    AppState.stores.forEach(s => {
      const escaped = s.replace(/"/g, '&quot;');
      select.innerHTML += `<option value="${escaped}" ${s === currentValue ? 'selected' : ''}>${s}</option>`;
    });
  });
}

// ─── Modal Helpers ──────────────────────────────────────────────────
function showModal(id) {
  document.getElementById(id).classList.add('active');
}

function hideModal(id) {
  document.getElementById(id).classList.remove('active');
}

// ─── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  await loadFilters();
  loadDashboard();
});
