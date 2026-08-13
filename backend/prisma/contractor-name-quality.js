function normalizeContractorName(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function isVerifiedDirectoryName(value, pan) {
  const name = normalizeContractorName(value);
  if (!name || name === String(pan || '').trim()) return false;
  if (/^\d+$/.test(name) || !/[\p{L}]/u.test(name)) return false;
  const visible = name.replace(/[?"'`\s.]/g, '');
  const questionRatio = (name.match(/\?/g) || []).length / Math.max(name.length, 1);
  return visible.length >= 3 && questionRatio <= 0.25;
}

module.exports = { isVerifiedDirectoryName, normalizeContractorName };
