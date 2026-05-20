// ─── Upload Order Data ──────────────────────────────────────────────
function initUploadZone(zoneId, inputId, type) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;

  // Drag & drop events
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file, type);
  });

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file, type);
    e.target.value = ''; // Reset input
  });
}

async function handleFileUpload(file, type) {
  if (!file.name.endsWith('.csv')) {
    showToast('error', 'Invalid File', 'Please upload a CSV file');
    return;
  }

  const resultId = type === 'order' ? 'order-upload-result' : 'master-upload-result';
  const resultDiv = document.getElementById(resultId);

  // Show loading
  resultDiv.innerHTML = `
    <div class="upload-result info" style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2);">
      <h4 style="color: var(--accent-blue);">⏳ Uploading ${file.name}...</h4>
      <div class="loading-overlay" style="padding: 10px 0;">
        <div class="spinner"></div>
        <span>Processing CSV data...</span>
      </div>
    </div>
  `;

  const formData = new FormData();
  formData.append('file', file);

  const endpoint = type === 'order' ? '/api/upload/order-data' : '/api/upload/master-kiosk';

  try {
    const res = await fetch(endpoint, { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error + (data.details ? '\n' + data.details.join('\n') : ''));
    }

    if (type === 'order') {
      resultDiv.innerHTML = `
        <div class="upload-result success">
          <h4>✅ Order Data Uploaded Successfully</h4>
          <div class="stats">
            <div class="stat-item">📄 File: <strong>${data.stats.file_name}</strong></div>
            <div class="stat-item">📝 Total Rows: <strong>${formatNumber(data.stats.total_rows)}</strong></div>
            <div class="stat-item">✅ Inserted: <strong>${formatNumber(data.stats.inserted)}</strong></div>
            <div class="stat-item">⚠️ Duplicates: <strong>${formatNumber(data.stats.duplicates)}</strong></div>
            <div class="stat-item">🏪 Per-Store: <strong>${formatNumber(data.stats.per_store)}</strong></div>
            <div class="stat-item">🖥️ Per-Unit: <strong>${formatNumber(data.stats.per_unit)}</strong></div>
          </div>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div class="upload-result success">
          <h4>✅ Master Kiosk Uploaded Successfully</h4>
          <div class="stats">
            <div class="stat-item">📄 File: <strong>${data.stats.file_name}</strong></div>
            <div class="stat-item">📝 Total Rows: <strong>${formatNumber(data.stats.total_rows)}</strong></div>
            <div class="stat-item">✅ Inserted/Updated: <strong>${formatNumber(data.stats.inserted_or_updated)}</strong></div>
          </div>
        </div>
      `;
    }

    showToast('success', 'Upload Complete', `${file.name} processed successfully`);

    // Refresh filters and data
    await loadFilters();
    loadUploadHistory();

  } catch (err) {
    resultDiv.innerHTML = `
      <div class="upload-result error">
        <h4>❌ Upload Failed</h4>
        <div class="stats">
          <div class="stat-item">${err.message}</div>
        </div>
      </div>
    `;
    showToast('error', 'Upload Failed', err.message);
  }
}

// ─── Upload History ─────────────────────────────────────────────────
async function loadUploadHistory() {
  try {
    const uploads = await api('/api/dashboard/uploads');
    const tbody = document.getElementById('upload-history-tbody');
    if (!tbody) return;

    if (uploads.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">
            No uploads yet
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = uploads.map(u => `
      <tr>
        <td>${formatDate(u.created_at)}</td>
        <td>${u.file_name}</td>
        <td>
          ${u.upload_type === 'ORDER_DATA'
            ? '<span class="badge badge-unit"><span class="badge-dot"></span>ORDER DATA</span>'
            : '<span class="badge badge-store"><span class="badge-dot"></span>MASTER KIOSK</span>'
          }
        </td>
        <td>${formatNumber(u.record_count)}${u.duplicate_count > 0 ? ` <span style="color: var(--text-muted);">(${u.duplicate_count} dup)</span>` : ''}</td>
        <td>
          ${u.upload_type === 'ORDER_DATA' ? `
            <button class="btn btn-ghost btn-sm" onclick="confirmDeleteBatch('${u.batch_id}', '${u.file_name}')" title="Delete batch">
              🗑️
            </button>
            <button class="btn btn-ghost btn-sm" onclick="reclassifyBatch('${u.batch_id}')" title="Re-classify">
              🔄
            </button>
          ` : ''}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Load upload history error:', err);
  }
}

// ─── Delete Batch ───────────────────────────────────────────────────
function confirmDeleteBatch(batchId, fileName) {
  document.getElementById('delete-batch-name').textContent = fileName;
  document.getElementById('delete-batch-id').value = batchId;
  showModal('delete-batch-modal');
}

async function deleteBatch() {
  const batchId = document.getElementById('delete-batch-id').value;
  try {
    await api(`/api/dashboard/orders/batch/${batchId}`, { method: 'DELETE' });
    hideModal('delete-batch-modal');
    showToast('success', 'Batch Deleted', 'Order batch has been removed');
    loadUploadHistory();
    await loadFilters();
    loadDashboard();
  } catch (err) {
    showToast('error', 'Delete Failed', err.message);
  }
}

// ─── Re-classify Batch ─────────────────────────────────────────────
async function reclassifyBatch(batchId) {
  if (!confirm('Re-classify all orders in this batch using the current master kiosk list?')) return;

  try {
    const result = await api(`/api/master/reclassify/${batchId}`, { method: 'POST' });
    showToast('success', 'Re-classification Complete', `${formatNumber(result.stats.total)} orders re-classified`);
    loadDashboard();
  } catch (err) {
    showToast('error', 'Re-classify Failed', err.message);
  }
}

// ─── Init upload zones on tab switch ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initUploadZone('order-upload-zone', 'order-file-input', 'order');
  initUploadZone('master-upload-zone', 'master-file-input', 'master');
});
