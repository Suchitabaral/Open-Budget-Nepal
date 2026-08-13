const fs = require('node:fs');

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]; const next = text[i + 1];
    if (char === '"') { if (quoted && next === '"') { cell += '"'; i += 1; } else quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') i += 1; row.push(cell); if (row.some(value => value !== '')) rows.push(row); row = []; cell = ''; continue; }
    cell += char;
  }
  if (cell || row.length) { row.push(cell); if (row.some(value => value !== '')) rows.push(row); }
  return rows;
}

function readCsv(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (!rows.length) return [];
  const headers = rows.shift().map(value => value.trim());
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, (values[index] || '').trim()])));
}

const escape = value => { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
function writeCsv(file, rows, headers) {
  const lines = [headers.join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))];
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
}

module.exports = { readCsv, writeCsv };
