// ChartForge — overlay.js
// Annotations, dashed lines, rectangles, drag system, save/load

let _drag = null;

// ── Container dblclick → memo (fires on chart-container, not overlay) ──
function onContainerDblClick(e, idx) {
  // Ignore if clicking on toolbar, overlay children, or drag in progress
  if (_drag) return;
  if (e.target.closest('.chart-toolbar,.chart-anno,.chart-hline,.chart-vline,.chart-rect,.anno-input')) return;
  e.preventDefault(); e.stopPropagation();

  const overlay = document.getElementById(`overlay-${idx}`);
  if (!overlay) return;
  _spawnMemoInput(overlay, e.clientX, e.clientY);
}

// ── Toolbar button → memo at center ──
function startMemo(idx) {
  const overlay = document.getElementById(`overlay-${idx}`);
  if (!overlay) return;
  const r = overlay.getBoundingClientRect();
  _spawnMemoInput(overlay, r.left + r.width / 2, r.top + r.height / 2);
}

function _spawnMemoInput(overlay, clientX, clientY) {
  overlay.querySelectorAll('.anno-input').forEach(el => el.remove());
  const rect = overlay.getBoundingClientRect();
  const x = clientX - rect.left, y = clientY - rect.top;

  const input = document.createElement('input');
  input.className = 'anno-input';
  input.style.left = x + 'px'; input.style.top = y + 'px';
  input.placeholder = '메모 입력 후 Enter...';
  input.style.pointerEvents = 'auto';
  overlay.appendChild(input);
  setTimeout(() => input.focus(), 30);

  const commit = () => {
    const t = input.value.trim();
    if (t) addAnno(overlay, x, y, t);
    if (input.parentElement) input.remove();
  };
  input.onkeydown = (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
    else if (ev.key === 'Escape') input.remove();
  };
  input.onblur = () => setTimeout(commit, 80);
}

// ── Memo ──
function addAnno(overlay, x, y, text) {
  const el = document.createElement('div');
  el.className = 'chart-anno'; el.dataset.type = 'anno';
  el.style.left = Math.max(0, x - 8) + 'px';
  el.style.top = Math.max(0, y - 28) + 'px';
  el.innerHTML = `<span class="ov-grip" title="드래그">⠿</span><span class="a-text">${text}</span><span class="ov-close" title="삭제">✕</span>`;
  overlay.appendChild(el);
  el.querySelector('.ov-close').onmousedown = (e) => { e.stopPropagation(); el.remove(); };
  _bindDrag(el, overlay, 'anno', '.ov-grip');
}

// ── Horizontal line ──
function addHLine(idx, posY) {
  const overlay = document.getElementById(`overlay-${idx}`);
  if (!overlay) return;
  const el = document.createElement('div');
  el.className = 'chart-hline'; el.dataset.type = 'hline';
  const existCount = overlay.querySelectorAll('.chart-hline').length;
  el.style.top = (posY != null ? posY : Math.round(overlay.offsetHeight * (0.3 + existCount * 0.1))) + 'px';
  el.innerHTML = `<div class="line-controls"><span class="ov-grip" title="드래그">⠿</span><span class="ov-close" title="삭제">✕</span></div>`;
  overlay.appendChild(el);
  el.querySelector('.ov-close').onmousedown = (e) => { e.stopPropagation(); el.remove(); };
  _bindDrag(el, overlay, 'hline', '.ov-grip');
}

// ── Vertical line ──
function addVLine(idx, posX) {
  const overlay = document.getElementById(`overlay-${idx}`);
  if (!overlay) return;
  const el = document.createElement('div');
  el.className = 'chart-vline'; el.dataset.type = 'vline';
  const existCount = overlay.querySelectorAll('.chart-vline').length;
  el.style.left = (posX != null ? posX : Math.round(overlay.offsetWidth * (0.3 + existCount * 0.1))) + 'px';
  el.innerHTML = `<div class="line-controls"><span class="ov-grip" title="드래그">⠿</span><span class="ov-close" title="삭제">✕</span></div>`;
  overlay.appendChild(el);
  el.querySelector('.ov-close').onmousedown = (e) => { e.stopPropagation(); el.remove(); };
  _bindDrag(el, overlay, 'vline', '.ov-grip');
}

// ── Rectangle ──
function addRect(idx, posX, posY, rw, rh) {
  const overlay = document.getElementById(`overlay-${idx}`);
  if (!overlay) return;
  const w = overlay.offsetWidth, h = overlay.offsetHeight;
  const el = document.createElement('div');
  el.className = 'chart-rect'; el.dataset.type = 'rect';
  const existRects = overlay.querySelectorAll('.chart-rect').length;
  el.style.left = (posX != null ? posX : Math.round(w * 0.2 + existRects * 20)) + 'px';
  el.style.top = (posY != null ? posY : Math.round(h * 0.2 + existRects * 20)) + 'px';
  el.style.width = (rw != null ? rw : Math.round(w * 0.4)) + 'px';
  el.style.height = (rh != null ? rh : Math.round(h * 0.4)) + 'px';
  el.innerHTML = `<div class="rect-controls"><span class="ov-grip" title="드래그">⠿</span><span class="ov-close" title="삭제">✕</span></div><span class="rect-resize"></span>`;
  overlay.appendChild(el);
  el.querySelector('.ov-close').onmousedown = (e) => { e.stopPropagation(); el.remove(); };
  _bindDrag(el, overlay, 'rect', '.ov-grip');
  el.querySelector('.rect-resize').onmousedown = (e) => {
    e.stopPropagation(); e.preventDefault();
    _drag = { type: 'resize', el, startW: el.offsetWidth, startH: el.offsetHeight, startX: e.clientX, startY: e.clientY };
  };
}

// ── Drag engine: only grip handle initiates drag ──
function _bindDrag(el, overlay, kind, gripSelector) {
  const grip = el.querySelector(gripSelector);
  if (!grip) return;
  grip.onmousedown = (e) => {
    e.preventDefault(); e.stopPropagation();
    _drag = {
      type: kind, el, overlay,
      oRect: overlay.getBoundingClientRect(),
      startX: e.clientX, startY: e.clientY,
      origLeft: parseFloat(el.style.left) || 0,
      origTop: parseFloat(el.style.top) || 0,
    };
    el.classList.add('dragging');
  };
}

document.addEventListener('mousemove', (e) => {
  if (!_drag) return;
  e.preventDefault();

  if (_drag.type === 'resize') {
    _drag.el.style.width = Math.max(30, _drag.startW + e.clientX - _drag.startX) + 'px';
    _drag.el.style.height = Math.max(20, _drag.startH + e.clientY - _drag.startY) + 'px';
    return;
  }

  const { el, oRect, startX, startY, origLeft, origTop, type } = _drag;
  const dx = e.clientX - startX, dy = e.clientY - startY;

  if (type === 'hline') {
    el.style.top = Math.max(0, Math.min(origTop + dy, oRect.height - 2)) + 'px';
  } else if (type === 'vline') {
    el.style.left = Math.max(0, Math.min(origLeft + dx, oRect.width - 2)) + 'px';
  } else {
    el.style.left = Math.max(0, Math.min(origLeft + dx, oRect.width - 30)) + 'px';
    el.style.top = Math.max(0, Math.min(origTop + dy, oRect.height - 20)) + 'px';
  }
});

document.addEventListener('mouseup', () => {
  if (_drag && _drag.el) _drag.el.classList.remove('dragging');
  _drag = null;
});

// ═══ Save / Load ═══
function saveAllOverlays() {
  const all = {};
  document.querySelectorAll('.chart-overlay').forEach(ov => {
    const idx = ov.id.replace('overlay-', '');
    const items = [];
    ov.querySelectorAll('[data-type]').forEach(el => {
      const o = { type: el.dataset.type, left: parseFloat(el.style.left)||0, top: parseFloat(el.style.top)||0 };
      if (o.type === 'anno') o.text = el.querySelector('.a-text')?.textContent || '';
      if (o.type === 'rect') { o.width = parseFloat(el.style.width)||100; o.height = parseFloat(el.style.height)||60; }
      items.push(o);
    });
    if (items.length) all[idx] = items;
  });
  return all;
}

function loadAllOverlays(all) {
  Object.entries(all).forEach(([idx, items]) => {
    const ov = document.getElementById(`overlay-${idx}`);
    if (!ov) return;
    ov.querySelectorAll('[data-type]').forEach(el => el.remove());
    const i = parseInt(idx);
    items.forEach(item => {
      if (item.type === 'anno') addAnno(ov, item.left + 8, item.top + 28, item.text);
      else if (item.type === 'hline') addHLine(i, item.top);
      else if (item.type === 'vline') addVLine(i, item.left);
      else if (item.type === 'rect') addRect(i, item.left, item.top, item.width, item.height);
    });
  });
}

function exportOverlaysJSON(idx) {
  closeAllMenus();
  const ov = document.getElementById(`overlay-${idx}`);
  if (!ov) return;
  const items = [];
  ov.querySelectorAll('[data-type]').forEach(el => {
    const o = { type: el.dataset.type, left: parseFloat(el.style.left)||0, top: parseFloat(el.style.top)||0 };
    if (o.type === 'anno') o.text = el.querySelector('.a-text')?.textContent || '';
    if (o.type === 'rect') { o.width = parseFloat(el.style.width)||100; o.height = parseFloat(el.style.height)||60; }
    items.push(o);
  });
  if (!items.length) {
    showToast('이 차트에 저장할 오버레이가 없습니다');
    return;
  }
  const card = document.querySelector(`.rec-card[data-idx="${idx}"]`);
  const title = card?.querySelector('.rec-title')?.textContent || 'chart';
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `overlay_${title}_${idx}.json`; a.click();
  URL.revokeObjectURL(a.href);
  showToast(`오버레이 ${items.length}개가 저장되었습니다`);
}

function importOverlaysJSON(idx) {
  closeAllMenus();
  const ov = document.getElementById(`overlay-${idx}`);
  if (!ov) return;

  const existCount = ov.querySelectorAll('[data-type]').length;
  if (existCount > 0) {
    if (!confirm(`이 차트에 오버레이 ${existCount}개가 있습니다.\n삭제하고 새로 로드하시겠습니까?`)) return;
    // 확인 → 즉시 삭제
    ov.querySelectorAll('[data-type]').forEach(el => el.remove());
  }

  // 파일 선택 창 오픈
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.onchange = () => {
    const file = input.files[0];
    document.body.removeChild(input);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const items = JSON.parse(evt.target.result);
        if (!Array.isArray(items)) throw new Error('invalid');
        items.forEach(item => {
          if (item.type === 'anno') addAnno(ov, item.left + 8, item.top + 28, item.text);
          else if (item.type === 'hline') addHLine(idx, item.top);
          else if (item.type === 'vline') addVLine(idx, item.left);
          else if (item.type === 'rect') addRect(idx, item.left, item.top, item.width, item.height);
        });
        showToast(`오버레이 ${items.length}개가 로드되었습니다`);
      } catch (err) {
        console.error('Overlay load error:', err);
        showToast('오버레이 파일을 읽을 수 없습니다');
      }
    };
    reader.readAsText(file);
  };

  setTimeout(() => input.click(), 50);
}

// ═══ Clear all overlays for a chart ═══
function clearOverlays(idx) {
  const ov = document.getElementById(`overlay-${idx}`);
  if (!ov) return;
  const count = ov.querySelectorAll('[data-type]').length;
  if (count === 0) {
    showToast('제거할 오버레이가 없습니다');
    return;
  }
  if (!confirm(`오버레이 ${count}개를 모두 제거하시겠습니까?`)) return;
  ov.querySelectorAll('[data-type]').forEach(el => el.remove());
  showToast(`오버레이 ${count}개가 제거되었습니다`);
}

// ═══ Toggle overlay visibility ═══
function toggleOverlayVisibility(idx, btn) {
  const overlay = document.getElementById(`overlay-${idx}`);
  if (!overlay) return;
  const hidden = overlay.style.display === 'none';
  overlay.style.display = hidden ? '' : 'none';
  btn.classList.toggle('active', hidden);
  btn.textContent = hidden ? '👁' : '🚫';
  btn.title = hidden ? '오버레이 보기/숨기기' : '오버레이 숨김 중 (클릭하여 표시)';
}
