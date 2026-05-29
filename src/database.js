const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'kiosk.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migration: recreate master_kiosks if it doesn't have store_code column
const masterKioskSchema = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='master_kiosks'"
).get();
if (masterKioskSchema && !masterKioskSchema.sql.includes('store_code')) {
  db.exec('DROP TABLE IF EXISTS master_kiosks');
}

// ─── Schema Creation ───────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS new_kiosks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    store_name TEXT NOT NULL,
    created_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_date TEXT NOT NULL,
    order_number TEXT UNIQUE NOT NULL,
    store_name TEXT NOT NULL,
    kiosk_name TEXT NOT NULL,
    billing_type TEXT NOT NULL,
    upload_batch TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    upload_type TEXT NOT NULL,
    record_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS master_kiosks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    store_code TEXT NOT NULL,
    store_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS kiosk_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alias_name TEXT UNIQUE NOT NULL,
    canonical_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_orders_kiosk_name ON orders(kiosk_name);
  CREATE INDEX IF NOT EXISTS idx_orders_billing_type ON orders(billing_type);
  CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
  CREATE INDEX IF NOT EXISTS idx_orders_upload_batch ON orders(upload_batch);
  CREATE INDEX IF NOT EXISTS idx_new_kiosks_name ON new_kiosks(name);
  CREATE INDEX IF NOT EXISTS idx_master_kiosks_name ON master_kiosks(name);
  CREATE INDEX IF NOT EXISTS idx_kiosk_aliases_alias ON kiosk_aliases(alias_name);
`);

// ─── Master Kiosk Queries ──────────────────────────────────────────

const insertKiosk = db.prepare(`
  INSERT OR REPLACE INTO new_kiosks (name, store_name, created_date)
  VALUES (?, ?, ?)
`);

const getAllKiosks = (search = '', page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const where = search
    ? `WHERE name LIKE ? OR store_name LIKE ?`
    : '';
  const params = search
    ? [`%${search}%`, `%${search}%`]
    : [];

  const rows = db.prepare(`
    SELECT * FROM new_kiosks ${where}
    ORDER BY name ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM new_kiosks ${where}
  `).get(...params);

  return { rows, total: total.count, page, limit };
};

const getKioskById = db.prepare('SELECT * FROM new_kiosks WHERE id = ?');

const updateKiosk = db.prepare(`
  UPDATE new_kiosks SET name = ?, store_name = ?, created_date = ?
  WHERE id = ?
`);

const deleteKiosk = db.prepare('DELETE FROM new_kiosks WHERE id = ?');

const deleteAllKiosks = db.prepare('DELETE FROM new_kiosks');

const getKioskCount = db.prepare('SELECT COUNT(*) as count FROM new_kiosks');

const isNewKiosk = db.prepare('SELECT id FROM new_kiosks WHERE name = ?');

// ─── Master Kiosk All Queries ──────────────────────────────────────

const insertMasterKiosk = db.prepare(`
  INSERT OR REPLACE INTO master_kiosks (name, store_code, store_name)
  VALUES (?, ?, ?)
`);

const deleteAllMasterKiosks = db.prepare('DELETE FROM master_kiosks');

const deleteMasterKiosk = db.prepare('DELETE FROM master_kiosks WHERE id = ?');

const getMasterKioskCount = db.prepare('SELECT COUNT(*) as count FROM master_kiosks');

const getMasterKioskById = db.prepare('SELECT * FROM master_kiosks WHERE id = ?');

const getAllMasterKiosks = (search = '', page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const where = search
    ? `WHERE name LIKE ? OR store_name LIKE ? OR store_code LIKE ?`
    : '';
  const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

  const rows = db.prepare(`
    SELECT * FROM master_kiosks ${where}
    ORDER BY store_name ASC, name ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM master_kiosks ${where}
  `).get(...params);

  return { rows, total: total.count, page, limit };
};

const insertMasterKioskBatch = db.transaction((kiosks) => {
  let inserted = 0;
  for (const k of kiosks) {
    const result = insertMasterKiosk.run(k.name, k.store_code, k.store_name);
    if (result.changes > 0) inserted++;
  }
  return { inserted };
});

const getStoreKioskReport = (month) => {
  const monthCondition = month
    ? `AND strftime('%Y-%m', order_date) = '${month.replace(/'/g, "''")}'`
    : '';

  return db.prepare(`
    SELECT * FROM (
      SELECT
        mk.store_name AS store_name,
        mk.name AS kiosk_name,
        CASE WHEN nk.id IS NOT NULL THEN 1 ELSE 0 END AS is_new,
        CASE WHEN o_active.kiosk_name IS NOT NULL THEN 1 ELSE 0 END AS is_active,
        CASE WHEN o_ever.kiosk_name IS NULL THEN 1 ELSE 0 END AS has_no_transactions,
        0 AS is_unregistered
      FROM master_kiosks mk
      LEFT JOIN new_kiosks nk ON mk.name = nk.name
      LEFT JOIN (
        SELECT DISTINCT kiosk_name FROM orders WHERE 1=1 ${monthCondition}
      ) o_active ON mk.name = o_active.kiosk_name
      LEFT JOIN (
        SELECT DISTINCT kiosk_name FROM orders
      ) o_ever ON mk.name = o_ever.kiosk_name

      UNION

      SELECT
        o2.store_name AS store_name,
        o2.kiosk_name AS kiosk_name,
        CASE WHEN nk2.id IS NOT NULL THEN 1 ELSE 0 END AS is_new,
        1 AS is_active,
        0 AS has_no_transactions,
        1 AS is_unregistered
      FROM (
        SELECT DISTINCT kiosk_name, store_name FROM orders WHERE 1=1 ${monthCondition}
      ) o2
      LEFT JOIN new_kiosks nk2 ON o2.kiosk_name = nk2.name
      WHERE o2.kiosk_name NOT IN (SELECT name FROM master_kiosks)
    )
    ORDER BY store_name ASC, kiosk_name ASC
  `).all();
};

// ─── Order Queries ─────────────────────────────────────────────────

const insertOrder = db.prepare(`
  INSERT OR IGNORE INTO orders (order_date, order_number, store_name, kiosk_name, billing_type, upload_batch)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const getOrders = (filters = {}) => {
  const { month, billing_type, store_name, kiosk_name, order_number, search, page = 1, limit = 25 } = filters;
  const conditions = [];
  const params = [];

  if (month) {
    conditions.push("strftime('%Y-%m', order_date) = ?");
    params.push(month);
  }
  if (billing_type) {
    conditions.push('billing_type = ?');
    params.push(billing_type);
  }
  if (store_name) {
    conditions.push('store_name = ?');
    params.push(store_name);
  }
  if (kiosk_name) {
    conditions.push('kiosk_name LIKE ?');
    params.push(`%${kiosk_name}%`);
  }
  if (order_number) {
    conditions.push('order_number LIKE ?');
    params.push(`%${order_number}%`);
  }
  if (search) {
    conditions.push('(order_number LIKE ? OR store_name LIKE ? OR kiosk_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const rows = db.prepare(`
    SELECT * FROM orders ${where}
    ORDER BY order_date DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM orders ${where}
  `).get(...params);

  return { rows, total: total.count, page, limit };
};

const getAllOrdersFiltered = (filters = {}) => {
  const { month, billing_type, store_name, kiosk_name, order_number } = filters;
  const conditions = [];
  const params = [];

  if (month) {
    conditions.push("strftime('%Y-%m', order_date) = ?");
    params.push(month);
  }
  if (billing_type) {
    conditions.push('billing_type = ?');
    params.push(billing_type);
  }
  if (store_name) {
    conditions.push('store_name = ?');
    params.push(store_name);
  }
  if (kiosk_name) {
    conditions.push('kiosk_name LIKE ?');
    params.push(`%${kiosk_name}%`);
  }
  if (order_number) {
    conditions.push('order_number LIKE ?');
    params.push(`%${order_number}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return db.prepare(`
    SELECT order_date, order_number, store_name, kiosk_name, billing_type
    FROM orders ${where}
    ORDER BY order_date DESC, id DESC
  `).all(...params);
};

// ─── Dashboard Queries ─────────────────────────────────────────────

const getSummary = (month) => {
  const monthFilter = month
    ? "WHERE strftime('%Y-%m', order_date) = ?"
    : '';
  const params = month ? [month] : [];

  const totalOrders = db.prepare(`
    SELECT COUNT(*) as count FROM orders ${monthFilter}
  `).get(...params);

  const perStoreOrders = db.prepare(`
    SELECT COUNT(*) as count FROM orders ${monthFilter ? monthFilter + " AND" : "WHERE"} billing_type = 'PER_STORE'
  `).get(...(month ? [month] : []));

  const perUnitOrders = db.prepare(`
    SELECT COUNT(*) as count FROM orders ${monthFilter ? monthFilter + " AND" : "WHERE"} billing_type = 'PER_UNIT'
  `).get(...(month ? [month] : []));

  const activeStores = db.prepare(`
    SELECT COUNT(DISTINCT store_name) as count FROM orders ${monthFilter ? monthFilter + " AND" : "WHERE"} billing_type = 'PER_STORE'
  `).get(...(month ? [month] : []));

  const activeNewKiosks = db.prepare(`
    SELECT COUNT(DISTINCT kiosk_name) as count FROM orders ${monthFilter ? monthFilter + " AND" : "WHERE"} billing_type = 'PER_UNIT'
  `).get(...(month ? [month] : []));

  const masterKioskCount = getKioskCount.get();

  return {
    total_orders: totalOrders.count,
    per_store_orders: perStoreOrders.count,
    per_unit_orders: perUnitOrders.count,
    active_stores: activeStores.count,
    active_new_kiosks: activeNewKiosks.count,
    master_kiosk_count: masterKioskCount.count
  };
};

const getMonthlyTrend = () => {
  return db.prepare(`
    SELECT 
      strftime('%Y-%m', order_date) as month,
      COUNT(*) as total,
      SUM(CASE WHEN billing_type = 'PER_STORE' THEN 1 ELSE 0 END) as per_store,
      SUM(CASE WHEN billing_type = 'PER_UNIT' THEN 1 ELSE 0 END) as per_unit
    FROM orders
    GROUP BY strftime('%Y-%m', order_date)
    ORDER BY month ASC
  `).all();
};

const getAvailableMonths = () => {
  return db.prepare(`
    SELECT DISTINCT strftime('%Y-%m', order_date) as month
    FROM orders
    ORDER BY month DESC
  `).all().map(r => r.month);
};

const getStoreList = () => {
  return db.prepare(`
    SELECT DISTINCT store_name FROM orders ORDER BY store_name ASC
  `).all().map(r => r.store_name);
};

const getBillingSummary = (month) => {
  const monthFilter = month
    ? "WHERE strftime('%Y-%m', order_date) = ?"
    : '';
  const params = month ? [month] : [];

  // Per-store billing: count unique stores with PER_STORE orders
  const perStoreBilling = db.prepare(`
    SELECT store_name, COUNT(*) as order_count, COUNT(DISTINCT kiosk_name) as kiosk_count
    FROM orders
    ${monthFilter ? monthFilter + " AND" : "WHERE"} billing_type = 'PER_STORE'
    GROUP BY store_name
    ORDER BY store_name ASC
  `).all(...(month ? [month] : []));

  // Per-unit billing: count unique kiosks
  const perUnitBilling = db.prepare(`
    SELECT kiosk_name, store_name, COUNT(*) as order_count
    FROM orders
    ${monthFilter ? monthFilter + " AND" : "WHERE"} billing_type = 'PER_UNIT'
    GROUP BY kiosk_name, store_name
    ORDER BY kiosk_name ASC
  `).all(...(month ? [month] : []));

  return {
    per_store: perStoreBilling,
    per_unit: perUnitBilling,
    per_store_total_stores: perStoreBilling.length,
    per_unit_total_kiosks: perUnitBilling.length
  };
};

// ─── Upload Queries ────────────────────────────────────────────────

const insertUpload = db.prepare(`
  INSERT INTO uploads (batch_id, file_name, upload_type, record_count, duplicate_count)
  VALUES (?, ?, ?, ?, ?)
`);

const getUploads = () => {
  return db.prepare(`
    SELECT * FROM uploads ORDER BY created_at DESC
  `).all();
};

const getBatchIds = () => {
  return db.prepare(`
    SELECT DISTINCT upload_batch FROM orders ORDER BY upload_batch DESC
  `).all().map(r => r.upload_batch);
};

// ─── Re-classify ───────────────────────────────────────────────────

const reclassifyBatch = (batchId) => {
  const orders = db.prepare('SELECT id, kiosk_name FROM orders WHERE upload_batch = ?').all(batchId);
  const updateBillingType = db.prepare('UPDATE orders SET billing_type = ? WHERE id = ?');

  let changed = 0;
  const reclassify = db.transaction(() => {
    for (const order of orders) {
      const found = isNewKiosk.get(order.kiosk_name);
      const newType = found ? 'PER_UNIT' : 'PER_STORE';
      updateBillingType.run(newType, order.id);
      changed++;
    }
  });

  reclassify();
  return { total: orders.length, changed };
};

// ─── Batch insert helpers ──────────────────────────────────────────

const insertKioskBatch = db.transaction((kiosks) => {
  let inserted = 0;
  for (const k of kiosks) {
    const result = insertKiosk.run(k.name, k.store_name, k.created_date);
    if (result.changes > 0) inserted++;
  }
  return inserted;
});

const insertOrderBatch = db.transaction((orders, batchId) => {
  let inserted = 0;
  let duplicates = 0;
  for (const o of orders) {
    const found = isNewKiosk.get(o.kiosk_name);
    const billingType = found ? 'PER_UNIT' : 'PER_STORE';
    const result = insertOrder.run(
      o.order_date, o.order_number, o.store_name, o.kiosk_name, billingType, batchId
    );
    if (result.changes > 0) {
      inserted++;
    } else {
      duplicates++;
    }
  }
  return { inserted, duplicates };
});

// ─── Order deletion ────────────────────────────────────────────────

const deleteOrdersByBatch = db.prepare('DELETE FROM orders WHERE upload_batch = ?');
const deleteUploadByBatch = db.prepare("DELETE FROM uploads WHERE batch_id = ?");

module.exports = {
  db,
  // Master kiosk (new/per-unit)
  getAllKiosks,
  getKioskById,
  updateKiosk,
  deleteKiosk,
  deleteAllKiosks,
  getKioskCount,
  insertKioskBatch,
  // Master kiosk all
  getAllMasterKiosks,
  getMasterKioskById,
  deleteMasterKiosk,
  insertMasterKioskBatch,
  deleteAllMasterKiosks,
  getMasterKioskCount,
  getStoreKioskReport,
  // Orders
  getOrders,
  getAllOrdersFiltered,
  insertOrderBatch,
  deleteOrdersByBatch,
  deleteUploadByBatch,
  // Dashboard
  getSummary,
  getMonthlyTrend,
  getAvailableMonths,
  getStoreList,
  getBillingSummary,
  // Uploads
  insertUpload,
  getUploads,
  getBatchIds,
  // Re-classify
  reclassifyBatch
};
