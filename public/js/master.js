// ─── Master Kiosk State ─────────────────────────────────────────────
let masterPage = 1;
let masterSearch = '';

// ─── Load Master Kiosks ─────────────────────────────────────────────
async function loadMasterKiosks(page = 1) {
  masterPage = page;
  const search = document.getElementById('master-search')?.value || '';
  masterSearch = search;

  try {
    const params = new URLSearchParams({ search, page, limit: 20 });
    const data = await api(`/api/master/kiosks?${params}`);

    const tbody = document.getElementById('master-tbody');
    const pagination = document.getElementById('master-pagination');
    const countEl = document.getElementById('master-count');

    if (countEl) countEl.textContent = `${formatNumber(data.total)} kiosks registered`;

    if (data.rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
            ${search ? 'No kiosks found matching your search' : 'No master kiosks registered. Upload a CSV to get started.'}
          </td>
        </tr>
      `;
      pagination.innerHTML = '';
      return;
    }

    tbody.innerHTML = data.rows.map(k => `
      <tr>
        <td><strong>${k.name}</strong></td>
        <td>${k.store_name}</td>
        <td>${formatDate(k.created_date)}</td>
        <td>${formatDate(k.created_at)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="editKiosk(${k.id})" title="Edit">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="confirmDeleteKiosk(${k.id}, '${k.name.replace(/'/g, "\\'")}')" title="Delete">🗑️</button>
        </td>
      </tr>
    `).join('');

    createPagination(pagination, data.total, data.page, data.limit, changeMasterPage);
  } catch (err) {
    console.error('Load master kiosks error:', err);
  }
}

function changeMasterPage(page) {
  loadMasterKiosks(page);
}

// ─── Master Search ──────────────────────────────────────────────────
let masterSearchTimeout;
function onMasterSearch() {
  clearTimeout(masterSearchTimeout);
  masterSearchTimeout = setTimeout(() => loadMasterKiosks(1), 400);
}

// ─── Edit Kiosk ─────────────────────────────────────────────────────
async function editKiosk(id) {
  try {
    const kiosk = await api(`/api/master/kiosks/${id}`);
    document.getElementById('edit-kiosk-id').value = kiosk.id;
    document.getElementById('edit-kiosk-name').value = kiosk.name;
    document.getElementById('edit-kiosk-store').value = kiosk.store_name;
    document.getElementById('edit-kiosk-date').value = kiosk.created_date;
    showModal('edit-kiosk-modal');
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

async function saveKiosk() {
  const id = document.getElementById('edit-kiosk-id').value;
  const body = {
    name: document.getElementById('edit-kiosk-name').value,
    store_name: document.getElementById('edit-kiosk-store').value,
    created_date: document.getElementById('edit-kiosk-date').value,
  };

  try {
    await api(`/api/master/kiosks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    hideModal('edit-kiosk-modal');
    showToast('success', 'Kiosk Updated', `${body.name} has been updated`);
    loadMasterKiosks(masterPage);
  } catch (err) {
    showToast('error', 'Update Failed', err.message);
  }
}

// ─── Delete Single Kiosk ────────────────────────────────────────────
function confirmDeleteKiosk(id, name) {
  document.getElementById('delete-kiosk-name').textContent = name;
  document.getElementById('delete-kiosk-id').value = id;
  showModal('delete-kiosk-modal');
}

async function deleteKiosk() {
  const id = document.getElementById('delete-kiosk-id').value;
  try {
    await api(`/api/master/kiosks/${id}`, { method: 'DELETE' });
    hideModal('delete-kiosk-modal');
    showToast('success', 'Kiosk Deleted', 'Kiosk has been removed from master list');
    loadMasterKiosks(masterPage);
  } catch (err) {
    showToast('error', 'Delete Failed', err.message);
  }
}

// ─── Delete ALL Kiosks ──────────────────────────────────────────────
function confirmDeleteAllKiosks() {
  showModal('delete-all-kiosks-modal');
}

async function deleteAllKiosks() {
  try {
    const result = await api('/api/master/kiosks/delete-all', { method: 'POST' });
    hideModal('delete-all-kiosks-modal');
    showToast('success', 'All Kiosks Deleted', result.message);
    loadMasterKiosks(1);
  } catch (err) {
    showToast('error', 'Delete Failed', err.message);
  }
}
