// ChartForge — app.js
// Upload, rendering pipeline, menus, table

// DOM references (set on load)
let dropZone, fileInput;

document.addEventListener("DOMContentLoaded", () => {
  dropZone = document.getElementById("dropZone");
  fileInput = document.getElementById("fileInput");
  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("dragover"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault(); dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", () => { if (fileInput.files.length) uploadFile(fileInput.files[0]); });
});

// ─────────────────────────────────────────────────────
// Upload Handling
// ─────────────────────────────────────────────────────


async function uploadFile(file) {
  const sizeMB = (file.size / 1024 / 1024).toFixed(1);
  _progressStart(`${file.name} (${sizeMB}MB)`);
  const form = new FormData();
  form.append('file', file);
  try {
    _progressStep('upload', '서버로 파일 전송 중...');
    const res = await fetch(API_BASE + '/api/analyze', { method: 'POST', body: form });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `HTTP ${res.status}`); }
    _progressDone('upload');

    _progressStep('parse', 'API 응답 파싱 중...');
    const data = await res.json();
    _progressDone('parse');

    await renderResultsAsync(data);
  } catch (e) { alert('오류: ' + e.message); }
  finally { _progressEnd(); }
}

// ─────────────────────────────────────────────────────
// Non-blocking Render Pipeline
// ─────────────────────────────────────────────────────
function _yield() { return new Promise(r => setTimeout(r, 0)); }

// Public entry point (called from demo button too)
function renderResults(data) {
  _progressStart(data.filename || '데이터');
  // Mark upload/parse as already done (data is pre-loaded)
  _progressStep('upload', '데이터 로드됨');
  _progressDone('upload');
  _progressStep('parse', '파싱 완료');
  _progressDone('parse');
  renderResultsAsync(data).then(() => _progressEnd());
}

async function renderResultsAsync(data) {
  chartInstances.forEach(c => c.dispose());
  chartInstances.length = 0;
  currentData = data;

  const results = document.getElementById('results');
  results.classList.add('active');

  // Step 1: Colors
  _progressStep('colors', '색상 시스템 초기화...');
  initColumnColors(data.column_analysis);
  initValueColors(data.column_analysis);
  _progressDone('colors');
  await _yield();

  // Step 2: Summary
  _progressStep('summary', '파일 요약 생성...');
  renderSummary(data);
  _progressDone('summary');
  await _yield();

  // Step 3: Columns
  _progressStep('columns', `컬럼 분석 렌더링 (${data.column_analysis.length}개)...`);
  renderColumns(data.column_analysis);
  _progressDone('columns');
  await _yield();

  // Step 4: Chart cards (DOM only, no rendering yet)
  _progressStep('cards', `차트 카드 생성 (${data.recommendations.length}개)...`);
  _createChartCards(data);
  _progressDone('cards');
  await _yield();

  // Step 5: Render charts one by one (non-blocking)
  const total = data.recommendations.length;
  for (let i = 0; i < total; i++) {
    const rec = data.recommendations[i];
    const chartId = `echart-${i}`;
    _progressStep('chart', `차트 렌더링 ${i + 1}/${total}: ${rec.name_ko}...`, Math.round((i / total) * 100));
    try { buildEChart(chartId, rec, data.preview); } catch (e) { console.warn(`Chart ${i} failed:`, e); }
    // Yield every chart to prevent blocking
    if (i % 2 === 0) await _yield();
  }
  _progressDone('chart');
  await _yield();

  // Step 6: Table
  _progressStep('table', '데이터 테이블 생성...');
  renderTable(data.preview);
  _progressDone('table');

  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.addEventListener('resize', () => chartInstances.forEach(c => c.resize()));
}

function _createChartCards(data) {
  const el = document.getElementById('recsGrid');
  el.innerHTML = '';

  data.recommendations.forEach((rec, idx) => {
    const card = document.createElement('div');
    const wideTypes = ['sankey','parallel','themeriver','treemap','sunburst','heatmap','calendar_heatmap','cross_heatmap','kpi_cards','wordcloud','pie_bar','bar_line_area'];
    card.className = `rec-card animate-in${wideTypes.includes(rec.chart_type) ? ' full-width' : ''}`;
    card.style.animationDelay = `${idx * 0.04}s`;
    card.dataset.idx = idx;

    const scoreClass = rec.score >= 85 ? 'high' : rec.score >= 70 ? 'mid' : 'low';
    const mappingHtml = Object.entries(rec.mapping).map(([axis, fields]) => {
      const fs = Array.isArray(fields) ? fields : [fields];
      return fs.map(f => `<span class="mapping-tag"><span class="axis">${axis}</span><span class="field">${f}</span></span>`).join('');
    }).join('');

    const chartId = `echart-${idx}`;
    const chartHeight = ['sankey','heatmap','parallel','themeriver','treemap','sunburst','calendar_heatmap','cross_heatmap'].includes(rec.chart_type) ? '380px' : '300px';

    card.innerHTML = `
      <div class="rec-card-head">
        <div class="rec-info" onclick="toggleCollapse(${idx})">
          <span class="rec-icon">${rec.icon}</span>
          <div><div class="rec-title">${rec.name_ko}</div><div class="rec-subtitle">${rec.name}</div></div>
        </div>
        <div class="rec-actions" onclick="event.stopPropagation()">
          <span class="rec-score ${scoreClass}">${rec.score}</span>
          <div class="menu-wrap">
            <button class="menu-btn" onclick="toggleMenu(${idx}, this)" title="메뉴">⋯</button>
            <div class="menu-dropdown" id="menu-${idx}">
              <button class="menu-item" onclick="saveChartImage(${idx})"><span class="mi-icon">📷</span>이미지로 저장</button>
              <button class="menu-item" onclick="copyChartCode(${idx})"><span class="mi-icon">📋</span>코드 복사</button>
              <button class="menu-item" onclick="exportChartCSV(${idx})"><span class="mi-icon">💾</span>데이터 CSV 저장</button>
              <div style="border-top:1px solid var(--border);margin:.3rem 0"></div>
              <button class="menu-item" onclick="exportOverlaysJSON(${idx})"><span class="mi-icon">📤</span>오버레이 저장</button>
              <button class="menu-item" onclick="importOverlaysJSON(${idx})"><span class="mi-icon">📥</span>오버레이 로드</button>
            </div>
          </div>
          <button class="collapse-btn" onclick="toggleCollapse(${idx})" title="접기/펼치기">▼</button>
        </div>
      </div>
      <div class="rec-body">
        <div class="rec-reason">${rec.reason}</div>
        <div class="rec-mapping">${mappingHtml}</div>
        <div class="chart-container" style="height:${chartHeight}" ondblclick="onContainerDblClick(event,${idx})">
          <div id="${chartId}" style="width:100%;height:100%"></div>
          <div class="chart-overlay" id="overlay-${idx}"></div>
          <div class="chart-toolbar">
            <button class="tb-btn" onclick="toggleOverlayVisibility(${idx}, this)" title="오버레이 보기/숨기기">👁</button>
            <button class="tb-btn" onclick="startMemo(${idx})" title="메모 추가">✎</button>
            <button class="tb-btn" onclick="addHLine(${idx})" title="가로 점선">━</button>
            <button class="tb-btn" onclick="addVLine(${idx})" title="세로 점선">┃</button>
            <button class="tb-btn" onclick="addRect(${idx})" title="점선 박스">▢</button>
            <button class="tb-btn" onclick="clearOverlays(${idx})" title="오버레이 모두 제거">🗑</button>
          </div>
        </div>
      </div>`;
    el.appendChild(card);
    card._rec = rec;
    card._chartId = chartId;
  });
}

// ─────────────────────────────────────────────────────
// Progress Tracker
// ─────────────────────────────────────────────────────
const STEP_LABELS = {
  upload: '📤 파일 전송', parse: '📋 응답 파싱', colors: '🎨 색상 초기화',
  summary: '📊 파일 요약', columns: '🔬 컬럼 분석', cards: '🃏 차트 카드 생성',
  chart: '📈 차트 렌더링', table: '📄 데이터 테이블',
};
let _stepTimers = {};

function _progressStart(title) {
  const loading = document.getElementById('loading');
  document.getElementById('loadingMsg').innerHTML = `<strong>${title}</strong>`;
  document.getElementById('progressSteps').innerHTML = Object.entries(STEP_LABELS).map(([k, v]) =>
    `<div class="p-step" id="ps-${k}"><span class="p-icon">○</span><span class="p-label">${v}</span><span class="p-time" id="pt-${k}"></span></div>`
  ).join('');
  document.getElementById('progressBar').style.width = '0%';
  _stepTimers = {};
  loading.classList.add('active');
}

function _progressStep(id, detail, pct) {
  _stepTimers[id] = performance.now();
  const step = document.getElementById(`ps-${id}`);
  if (step) { step.className = 'p-step active'; step.querySelector('.p-icon').textContent = '⟳'; }
  // Update bar
  const keys = Object.keys(STEP_LABELS);
  const idx = keys.indexOf(id);
  const barPct = pct != null ? pct : Math.round(((idx + 0.5) / keys.length) * 100);
  document.getElementById('progressBar').style.width = barPct + '%';
  // Update main message
  document.getElementById('loadingMsg').innerHTML = detail || '';
}

function _progressDone(id) {
  const elapsed = _stepTimers[id] ? Math.round(performance.now() - _stepTimers[id]) : 0;
  const step = document.getElementById(`ps-${id}`);
  if (step) {
    step.className = 'p-step done';
    step.querySelector('.p-icon').textContent = '✓';
    const timeEl = document.getElementById(`pt-${id}`);
    if (timeEl) timeEl.textContent = elapsed >= 1000 ? (elapsed / 1000).toFixed(1) + 's' : elapsed + 'ms';
  }
  const keys = Object.keys(STEP_LABELS);
  const idx = keys.indexOf(id);
  document.getElementById('progressBar').style.width = Math.round(((idx + 1) / keys.length) * 100) + '%';
}

function _progressEnd() {
  document.getElementById('progressBar').style.width = '100%';
  setTimeout(() => document.getElementById('loading').classList.remove('active'), 400);
}

function renderSummary(data) {
  const el = document.getElementById('fileSummary');
  const numericCols = data.column_analysis.filter(c => c.semantic_type === 'numeric').length;
  const si = data.sampling_info;
  const sampledHtml = si && si.sampled ? `
    <div class="stat-card animate-in delay-2"><div class="label">샘플링</div>
      <div class="value" style="font-size:.85rem;color:var(--cyan)">
        ${si.analysis_sample.toLocaleString()}행 분석<br>
        <span style="font-size:.7rem;color:var(--text-muted)">${si.original_rows.toLocaleString()}행 중</span>
      </div></div>` : '';
  const timeHtml = data.processing_time_ms ? `
    <div class="stat-card animate-in delay-2"><div class="label">처리 시간</div>
      <div class="value" style="font-size:1.2rem;color:var(--text-dim)">${data.processing_time_ms >= 1000 ? (data.processing_time_ms/1000).toFixed(1)+'s' : data.processing_time_ms+'ms'}</div></div>` : '';
  el.innerHTML = `
    <div class="stat-card animate-in"><div class="label">파일명</div><div class="value" style="font-size:1rem;word-break:break-all">${data.filename}</div></div>
    <div class="stat-card animate-in delay-1"><div class="label">행 수</div><div class="value accent">${data.shape.rows.toLocaleString()}</div></div>
    <div class="stat-card animate-in delay-1"><div class="label">컬럼 수</div><div class="value green">${data.shape.columns}</div></div>
    <div class="stat-card animate-in delay-2"><div class="label">수치형 컬럼</div><div class="value amber">${numericCols}</div></div>
    <div class="stat-card animate-in delay-2"><div class="label">추천 차트</div><div class="value accent">${data.recommendations.length}</div></div>
    ${sampledHtml}${timeHtml}`;
}

function renderColumns(cols) {
  document.getElementById('columnsGrid').innerHTML = cols.map((c, idx) => {
    const color = columnColors[c.name] || PALETTE[idx % PALETTE.length];
    const hasCatValues = c.top_values && Object.keys(c.top_values).length >= 2;

    // Build value color chips HTML
    let valChipsHtml = '';
    if (hasCatValues) {
      const vals = Object.keys(c.top_values);
      valChipsHtml = `
        <div class="val-colors-section">
          <div class="val-colors-title">분류값 색상 (${vals.length})</div>
          <div class="val-colors-grid">
            ${vals.map((v, vi) => {
              const vKey = c.name + '::' + v;
              const vColor = valueColors[vKey] || PALETTE[vi % PALETTE.length];
              return `<div class="val-color-chip">
                <div class="val-color-dot" style="background:${vColor}">
                  <input type="color" value="${vColor}" data-vkey="${vKey}" data-col="${c.name}" data-val="${v}"
                         onchange="onValueColorChange(this)">
                </div>
                <span class="val-color-name" title="${v}">${v}</span>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }

    const isDisabled = disabledColumns.has(c.name);
    return `
    <div class="col-card animate-in${isDisabled ? ' disabled' : ''}" data-colname="${c.name}">
      <div class="col-card-header">
        <span class="col-name">${c.name}</span>
        <div style="display:flex;align-items:center;gap:.4rem">
          <span class="col-type ${c.semantic_type}">${c.semantic_type}</span>
          <button class="col-toggle${isDisabled ? ' off' : ''}" onclick="onColumnToggle('${c.name}', this)" title="${isDisabled ? '차트에 포함' : '차트에서 제외'}"></button>
        </div>
      </div>
      <div class="col-color-row">
        <div class="col-color-swatch" id="swatch-${idx}" style="background:${color}">
          <input type="color" value="${color}" data-col="${c.name}" data-idx="${idx}"
                 onchange="onColumnColorChange(this)">
        </div>
        <span class="col-color-label">${color}</span>
      </div>
      <div class="col-meta">
        <strong>${c.unique_count}</strong> 고유값 · <strong>${c.null_pct}%</strong> 결측
        ${c.stats ? `<br>범위: <strong>${fmtNum(c.stats.min)}</strong> ~ <strong>${fmtNum(c.stats.max)}</strong>` : ''}
        ${c.stats && c.stats.mean !== undefined ? `<br>평균: <strong>${fmtNum(c.stats.mean)}</strong> · 표준편차: <strong>${fmtNum(c.stats.std)}</strong>` : ''}
      </div>
      ${valChipsHtml}
      <div class="col-samples">${(c.sample_values||[]).map(v=>`<span class="sample-chip" title="${v}">${v}</span>`).join('')}</div>
    </div>`;
  }).join('');
}

function onColumnColorChange(input) {
  const colName = input.dataset.col;
  const idx = input.dataset.idx;
  const newColor = input.value;
  columnColors[colName] = newColor;

  const swatch = document.getElementById(`swatch-${idx}`);
  if (swatch) swatch.style.background = newColor;
  const label = swatch?.parentElement?.querySelector('.col-color-label');
  if (label) label.textContent = newColor;

  reRenderCharts();
}

function onValueColorChange(input) {
  const vKey = input.dataset.vkey;
  const newColor = input.value;
  valueColors[vKey] = newColor;
  input.parentElement.style.background = newColor;
  reRenderCharts();
}

function onColumnToggle(colName, btn) {
  if (disabledColumns.has(colName)) {
    disabledColumns.delete(colName);
    btn.classList.remove('off');
    btn.title = '차트에서 제외';
  } else {
    disabledColumns.add(colName);
    btn.classList.add('off');
    btn.title = '차트에 포함';
  }
  // Update column card visual
  const card = btn.closest('.col-card');
  if (card) card.classList.toggle('disabled', disabledColumns.has(colName));

  applyColumnFilter();
}

function applyColumnFilter() {
  if (!currentData) return;
  document.querySelectorAll('.rec-card').forEach(card => {
    const idx = parseInt(card.dataset.idx);
    const rec = currentData.recommendations[idx];
    if (!rec) return;

    // Check if any disabled column is used in this chart's mapping
    const m = rec.mapping;
    const usedCols = new Set();
    if (m.x) { (Array.isArray(m.x) ? m.x : [m.x]).forEach(c => usedCols.add(c)); }
    if (m.y) { m.y.forEach(c => usedCols.add(c)); }
    if (m.group) usedCols.add(m.group);
    // Remove meta-columns
    usedCols.delete('columns'); usedCols.delete('rows'); usedCols.delete('summary');

    const hasDisabled = [...usedCols].some(c => disabledColumns.has(c));
    card.classList.toggle('col-hidden', hasDisabled);
  });

  // Update count in summary
  const visibleCount = document.querySelectorAll('.rec-card:not(.col-hidden)').length;
  const totalCount = currentData.recommendations.length;
  const countEl = document.getElementById('fileSummary')?.querySelector('.value.accent:last-of-type');
  // No need to update if element doesn't exist
}

// ─── Collapse ───
function toggleCollapse(idx) {
  const card = document.querySelector(`.rec-card[data-idx="${idx}"]`);
  if (!card) return;
  card.classList.toggle('collapsed');
  // Resize chart when expanding
  if (!card.classList.contains('collapsed')) {
    const ci = chartInstances.find(c => c.getDom()?.id === `echart-${idx}`);
    if (ci) setTimeout(() => ci.resize(), 350);
  }
}

// ─── Menu ───
function toggleMenu(idx, btn) {
  event.stopPropagation();

  // Close any open menu
  const existing = document.getElementById('active-menu');
  if (existing) { existing.remove(); }

  // Check if this menu was already open (toggle off)
  if (btn.dataset.open === 'true') {
    btn.dataset.open = '';
    return;
  }
  // Reset all buttons
  document.querySelectorAll('.menu-btn[data-open="true"]').forEach(b => b.dataset.open = '');

  // Clone menu content and portal to body
  const menuSrc = document.getElementById(`menu-${idx}`);
  const menu = menuSrc.cloneNode(true);
  menu.id = 'active-menu';
  menu.style.display = 'block';
  document.body.appendChild(menu);

  // Position directly below ⋯ button
  const r = btn.getBoundingClientRect();
  const mw = menu.offsetWidth || 200;
  let left = r.left + r.width / 2 - mw / 2; // center under button
  if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
  if (left < 8) left = 8;
  menu.style.top = (r.bottom + 4) + 'px';
  menu.style.left = left + 'px';

  btn.dataset.open = 'true';

  // Close on any outside click
  const close = (e) => {
    if (!menu.contains(e.target) && e.target !== btn) {
      menu.remove();
      btn.dataset.open = '';
      document.removeEventListener('click', close, true);
    }
  };
  setTimeout(() => document.addEventListener('click', close, true), 10);

  // Close on menu item click
  menu.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      menu.remove();
      btn.dataset.open = '';
      document.removeEventListener('click', close, true);
    });
  });
}

function saveChartImage(idx) {
  const ci = chartInstances.find(c => c.getDom()?.id === `echart-${idx}`);
  if (!ci) return;
  const card = document.querySelector(`.rec-card[data-idx="${idx}"]`);
  const title = card?.querySelector('.rec-title')?.textContent || 'chart';
  const overlay = document.getElementById(`overlay-${idx}`);
  const container = overlay?.parentElement;

  // Get ECharts base image
  const scale = 2;
  const baseURL = ci.getDataURL({ type: 'png', pixelRatio: scale, backgroundColor: '#1a1b24' });

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Draw overlays if any
    if (overlay && container) {
      const cw = container.offsetWidth, ch = container.offsetHeight;

      // Horizontal lines
      overlay.querySelectorAll('.chart-hline').forEach(el => {
        const y = (parseFloat(el.style.top) || 0) * scale;
        ctx.setLineDash([4 * scale, 4 * scale]);
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 0.5 * scale;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      });

      // Vertical lines
      overlay.querySelectorAll('.chart-vline').forEach(el => {
        const x = (parseFloat(el.style.left) || 0) * scale;
        ctx.setLineDash([4 * scale, 4 * scale]);
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 0.5 * scale;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      });

      // Rectangles
      overlay.querySelectorAll('.chart-rect').forEach(el => {
        const rx = (parseFloat(el.style.left) || 0) * scale;
        const ry = (parseFloat(el.style.top) || 0) * scale;
        const rw = (parseFloat(el.style.width) || 100) * scale;
        const rh = (parseFloat(el.style.height) || 60) * scale;
        ctx.setLineDash([4 * scale, 4 * scale]);
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 0.5 * scale;
        ctx.strokeRect(rx, ry, rw, rh);
      });

      // Memos
      ctx.setLineDash([]);
      overlay.querySelectorAll('.chart-anno').forEach(el => {
        const tx = (parseFloat(el.style.left) || 0) * scale;
        const ty = (parseFloat(el.style.top) || 0) * scale;
        const text = el.querySelector('.a-text')?.textContent || '';
        if (!text) return;
        ctx.font = `${12 * scale}px 'Noto Sans KR', sans-serif`;
        ctx.fillStyle = '#e8e9f0';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 4 * scale;
        ctx.fillText(text, tx + 4 * scale, ty + 14 * scale);
        ctx.shadowBlur = 0;
      });
    }

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `chartforge_${title}_${idx}.png`;
    a.click();
  };
  img.src = baseURL;
  closeAllMenus();
}

function copyChartCode(idx) {
  const ci = chartInstances.find(c => c.getDom()?.id === `echart-${idx}`);
  if (!ci) return;
  const opt = ci.getOption();
  // Clean for export
  const cleaned = JSON.parse(JSON.stringify(opt, (k, v) => {
    if (k === 'backgroundColor' || k === 'animationDuration' || k === 'animationEasing') return undefined;
    return v;
  }));
  const code = `// Apache ECharts Option\nconst option = ${JSON.stringify(cleaned, null, 2)};\n\n// Usage:\n// const chart = echarts.init(document.getElementById('chart'));\n// chart.setOption(option);`;
  navigator.clipboard.writeText(code).then(() => {
    showToast('차트 코드가 클립보드에 복사되었습니다');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = code; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('차트 코드가 복사되었습니다');
  });
  closeAllMenus();
}

function exportChartCSV(idx) {
  if (!currentData) return;
  const card = document.querySelector(`.rec-card[data-idx="${idx}"]`);
  const rec = card?._rec;
  if (!rec) return;

  const m = rec.mapping;
  const rows = currentData.preview.data;
  // Collect relevant columns
  const cols = new Set();
  if (m.x) { (Array.isArray(m.x) ? m.x : [m.x]).forEach(c => cols.add(c)); }
  if (m.y) { m.y.forEach(c => cols.add(c)); }
  if (m.group) cols.add(m.group);
  // Filter to actual columns
  const validCols = [...cols].filter(c => currentData.preview.columns.includes(c));
  if (!validCols.length) { validCols.push(...currentData.preview.columns.slice(0, 5)); }

  let csv = validCols.join(',') + '\n';
  rows.forEach(r => {
    csv += validCols.map(c => {
      const v = r[c];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',') + '\n';
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const title = card?.querySelector('.rec-title')?.textContent || 'data';
  a.download = `chartforge_${title}_${idx}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  closeAllMenus();
}

function closeAllMenus() {
  const m = document.getElementById('active-menu');
  if (m) m.remove();
  document.querySelectorAll('.menu-btn[data-open="true"]').forEach(b => b.dataset.open = '');
}

// ─── Toast ───
function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--surface2);color:var(--text);border:1px solid var(--border);padding:.7rem 1.4rem;border-radius:10px;font-size:.85rem;z-index:9999;opacity:0;transition:opacity .3s;box-shadow:0 4px 20px rgba(0,0,0,.5);pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; }, 2500);
}


function renderTable(preview) {
  const wrap = document.getElementById('tableWrap');
  const cols = preview.columns, rows = preview.data.slice(0, 100);
  let html = '<table><thead><tr><th>#</th>';
  cols.forEach(c => html += `<th>${c}</th>`);
  html += '</tr></thead><tbody>';
  rows.forEach((r, i) => {
    html += `<tr><td style="color:var(--text-muted)">${i+1}</td>`;
    cols.forEach(c => {
      const v = r[c];
      html += v===null||v===undefined ? `<td class="null">null</td>` : `<td title="${String(v)}">${String(v)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

