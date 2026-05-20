const { parse } = require('csv-parse/sync');

/**
 * Parse CSV content and return array of objects.
 * Handles common date format variations.
 */
function parseCSV(content) {
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true, // handle BOM character from Excel exports
  });
  return records;
}

/**
 * Normalize date string to YYYY-MM-DD format.
 * Handles formats like:
 *   "4/1/2026"       → "2026-04-01"
 *   "04/01/2026"     → "2026-04-01"
 *   "2026-04-01"     → "2026-04-01"
 *   "2/19/2026 8:42" → "2026-02-19"
 */
function normalizeDate(dateStr) {
  if (!dateStr) return '';

  // Remove time portion if present
  const datePart = dateStr.split(' ')[0];

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }

  // M/D/YYYY or MM/DD/YYYY format
  const parts = datePart.split('/');
  if (parts.length === 3) {
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${year}-${month}-${day}`;
  }

  // Fallback: try native Date parsing
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return dateStr; // Return as-is if can't parse
}

/**
 * Parse and validate master kiosk CSV.
 * Expected columns: created, name, store_name
 */
function parseMasterKioskCSV(content) {
  const records = parseCSV(content);
  const errors = [];

  const validated = records.map((row, idx) => {
    const name = (row.name || '').trim();
    const store_name = (row.store_name || '').trim();
    const created = (row.created || '').trim();

    if (!name) errors.push(`Row ${idx + 2}: missing 'name'`);
    if (!store_name) errors.push(`Row ${idx + 2}: missing 'store_name'`);
    if (!created) errors.push(`Row ${idx + 2}: missing 'created'`);

    return {
      name,
      store_name,
      created_date: normalizeDate(created)
    };
  });

  return { data: validated, errors };
}

/**
 * Parse and validate order data CSV.
 * Expected columns: order_date, order_number, store_name, kiosk_name
 */
function parseOrderDataCSV(content) {
  const records = parseCSV(content);
  const errors = [];

  const validated = records.map((row, idx) => {
    const order_date = (row.order_date || '').trim();
    const order_number = (row.order_number || '').trim();
    const store_name = (row.store_name || '').trim();
    const kiosk_name = (row.kiosk_name || '').trim();

    if (!order_date) errors.push(`Row ${idx + 2}: missing 'order_date'`);
    if (!order_number) errors.push(`Row ${idx + 2}: missing 'order_number'`);
    if (!store_name) errors.push(`Row ${idx + 2}: missing 'store_name'`);
    if (!kiosk_name) errors.push(`Row ${idx + 2}: missing 'kiosk_name'`);

    return {
      order_date: normalizeDate(order_date),
      order_number,
      store_name,
      kiosk_name
    };
  });

  return { data: validated, errors };
}

module.exports = {
  parseCSV,
  normalizeDate,
  parseMasterKioskCSV,
  parseOrderDataCSV
};
