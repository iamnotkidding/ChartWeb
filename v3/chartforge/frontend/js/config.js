// ChartForge — config.js
// API endpoint, ECharts theme, palette, global utilities

const API_BASE = "";  // Same origin — run.py serves both

// ─────────────────────────────────────────────────────
// Apache ECharts — Dark Theme & Palette
// ─────────────────────────────────────────────────────
const PALETTE = ['#4f7df9','#34d399','#fbbf24','#f87171','#a78bfa','#22d3ee','#fb923c','#ec4899','#6ee7b7','#93c5fd'];

const ECHARTS_THEME = {
  backgroundColor: 'transparent',
  textStyle: { color: '#8b8d9e', fontFamily: "'Noto Sans KR', system-ui" },
  title: { textStyle: { color: '#8b8d9e', fontSize: 12, fontWeight: 500 } },
  legend: {
    textStyle: { color: '#8b8d9e', fontSize: 11 },
    pageTextStyle: { color: '#8b8d9e' },
    icon: 'roundRect',
    itemWidth: 12, itemHeight: 8,
  },
  tooltip: {
    backgroundColor: '#1a1b24ee',
    borderColor: '#2a2b38',
    textStyle: { color: '#e8e9f0', fontSize: 12 },
    borderWidth: 1,
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#2a2b3860' } },
    axisTick: { lineStyle: { color: '#2a2b3860' } },
    axisLabel: { color: '#8b8d9e', fontSize: 10 },
    splitLine: { lineStyle: { color: '#2a2b3830' } },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#8b8d9e', fontSize: 10 },
    splitLine: { lineStyle: { color: '#2a2b3825', type: 'dashed' } },
  },
};

echarts.registerTheme('chartforge', ECHARTS_THEME);

// Track ECharts instances for cleanup
const chartInstances = [];

function fmtNum(v) {
  if (v==null) return '-';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (Math.abs(n)>=1e6) return (n/1e6).toFixed(1)+'M';
  if (Math.abs(n)>=1e3) return (n/1e3).toFixed(1)+'K';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
