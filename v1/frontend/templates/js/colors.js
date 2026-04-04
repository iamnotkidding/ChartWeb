// ChartForge — colors.js
// Column & value color management

// ─────────────────────────────────────────────────────
// Column Color System
// ─────────────────────────────────────────────────────
const columnColors = {};   // colName → hex color
const valueColors  = {};   // "colName::value" → hex color
const disabledColumns = new Set(); // columns excluded from charts
let currentData = null;    // latest analysis result

// Column-level color
function C(colName) {
  return columnColors[colName] || PALETTE[0];
}

// Value-level color: VC("카테고리", "전자제품") → color
function VC(colName, value) {
  const key = colName + '::' + String(value);
  return valueColors[key] || Pi(0);
}

// Get ordered palette from all column colors
function CP() {
  if (!currentData) return PALETTE;
  return currentData.column_analysis.map(c => columnColors[c.name] || PALETTE[0]);
}

// Get color at index i from dynamic palette
function Pi(i) {
  const p = CP();
  return p[i % p.length];
}

// Assign default colors to columns
function initColumnColors(cols) {
  cols.forEach((c, i) => {
    if (!columnColors[c.name]) {
      columnColors[c.name] = PALETTE[i % PALETTE.length];
    }
  });
}

// Assign default colors to category values within each column
function initValueColors(cols) {
  cols.forEach(c => {
    if (!c.top_values) return;
    const vals = Object.keys(c.top_values);
    vals.forEach((v, vi) => {
      const key = c.name + '::' + v;
      if (!valueColors[key]) {
        valueColors[key] = PALETTE[vi % PALETTE.length];
      }
    });
  });
}

// Re-render all charts with current colors
function reRenderCharts() {
  if (!currentData) return;
  chartInstances.forEach(c => c.dispose());
  chartInstances.length = 0;
  // Only re-render the ECharts, not the DOM cards
  currentData.recommendations.forEach((rec, i) => {
    try { buildEChart(`echart-${i}`, rec, currentData.preview); } catch(e) {}
  });
}
