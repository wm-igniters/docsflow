const { patch } = require('node-diff3');
const fs = require('fs');
const path = require('path');

// Use the local JSON doc dump (see scripts/testdoc.json).
const docPath = path.join(__dirname, 'testdoc.json');

function normalizeText(text) {
  return String(text ?? '').replace(/\r\n/g, '\n');
}

function coerceText(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function extractTimestamp(entry) {
  const ts = entry?.timestamp;
  if (!ts) return 0;
  if (typeof ts === 'string') return new Date(ts).getTime();
  if (typeof ts === 'object' && typeof ts.$date === 'string') return new Date(ts.$date).getTime();
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

function sortHistoryByTimestamp(historyEntries) {
  return [...historyEntries].sort((a, b) => extractTimestamp(a) - extractTimestamp(b));
}

function applyHistory(original, historyEntries) {
  let current = original;
  for (const entry of historyEntries) {
    const changes = entry?.changes || entry; // support raw history items or just the changes
    if (!changes || changes.type !== 'diffPatch') continue;
    const separator = changes.lineSeparator || '\n';
    const currentLines = current.split(separator);
    const nextLines = patch(currentLines, changes.patch);
    current = nextLines.join(separator);
  }
  return current;
}

const raw = fs.readFileSync(docPath, 'utf8');
const doc = JSON.parse(raw);

const originalGithub = normalizeText(coerceText(doc.github_data));
const finalData = normalizeText(coerceText(doc.docsflow_data));
const history = sortHistoryByTimestamp(Array.isArray(doc.history) ? doc.history : []);

const reconstructedFromGithub = applyHistory(originalGithub, history);
const reconstructedFromEmpty = applyHistory('', history);
const isMatchGithub = reconstructedFromGithub === finalData;
const isMatchEmpty = reconstructedFromEmpty === finalData;

const reconstructed = isMatchGithub ? reconstructedFromGithub : reconstructedFromEmpty;
const isMatch = isMatchGithub || isMatchEmpty;

console.log('History replay match:', isMatch);
if (isMatch) {
  console.log('Matched baseline:', isMatchGithub ? 'github_data' : 'empty string');
} else {
  console.log('Matched baseline: none');
}
if (!isMatch) {
  console.log('Expected:');
  console.log(finalData);
  console.log('Actual:');
  console.log(reconstructed);
}
