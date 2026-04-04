// ChartForge — overlay.js v3
// Overlays with properties panel, memo editing, copy, rotate, save/load

let _drag = null;

// ── Container dblclick → memo ──
function onContainerDblClick(e, idx) {
  if (_drag) return;
  const tgt = e.target;
  // Double-click on existing memo → edit
  const anno = tgt.closest('.chart-anno');
  if (anno) { _editMemo(anno); return; }
  if (tgt.closest('.chart-toolbar,.chart-hline,.chart-vline,.chart-rect,.anno-input,.ov-props')) return;
  e.preventDefault(); e.stopPropagation();
  const overlay = document.getElementById(`overlay-${idx}`);
  if (!overlay) return;
  _spawnMemoInput(overlay, e.clientX, e.clientY);
}

function startMemo(idx) {
  const overlay = document.getElementById(`overlay-${idx}`);
  if (!overlay) return;
  const r = overlay.getBoundingClientRect();
  _spawnMemoInput(overlay, r.left + r.width/2, r.top + r.height/2);
}

function _spawnMemoInput(overlay, cx, cy, existingEl, existingText) {
  overlay.querySelectorAll('.anno-input').forEach(el => el.remove());
  const rect = overlay.getBoundingClientRect();
  const x = cx - rect.left, y = cy - rect.top;
  const input = document.createElement('input');
  input.className = 'anno-input';
  input.style.left = x + 'px'; input.style.top = y + 'px';
  input.style.pointerEvents = 'auto';
  input.value = existingText || '';
  input.placeholder = '메모 입력 후 Enter...';
  overlay.appendChild(input);
  setTimeout(() => { input.focus(); input.select(); }, 30);
  const commit = () => {
    const t = input.value.trim();
    if (existingEl) {
      if (t) { existingEl.querySelector('.a-text').textContent = t; existingEl.style.display = ''; }
      else existingEl.remove();
    } else if (t) addAnno(overlay, x, y, t);
    if (input.parentElement) input.remove();
  };
  input.onkeydown = (ev) => { if (ev.key==='Enter'){ev.preventDefault();commit()} else if(ev.key==='Escape'){if(existingEl)existingEl.style.display='';input.remove()} };
  input.onblur = () => setTimeout(commit, 80);
}

function _editMemo(anno) {
  const text = anno.querySelector('.a-text')?.textContent || '';
  const overlay = anno.parentElement;
  const r = anno.getBoundingClientRect();
  const or = overlay.getBoundingClientRect();
  anno.style.display = 'none';
  _spawnMemoInput(overlay, r.left, r.top, anno, text);
}

// ── Memo ──
function addAnno(overlay, x, y, text, props) {
  const el = document.createElement('div');
  el.className = 'chart-anno'; el.dataset.type = 'anno';
  el.style.left = Math.max(0,x-8)+'px'; el.style.top = Math.max(0,y-28)+'px';
  if (props?.color) el.style.color = props.color;
  if (props?.fontSize) el.style.fontSize = props.fontSize + 'px';
  el.innerHTML = `<span class="ov-grip" title="드래그">⠿</span><span class="a-text">${text}</span><span class="ov-close" title="삭제">✕</span>`;
  overlay.appendChild(el);
  el.querySelector('.ov-close').onmousedown = (e) => { e.stopPropagation(); el.remove(); };
  _bindDrag(el, overlay, 'anno', '.ov-grip');
  // Right-click → properties
  el.oncontextmenu = (e) => { e.preventDefault(); _showProps(el, overlay, 'anno'); };
}

// ── Lines ──
function addHLine(idx, posY, props) {
  const overlay = document.getElementById(`overlay-${idx}`);
  if (!overlay) return;
  const el = document.createElement('div');
  el.className = 'chart-hline'; el.dataset.type = 'hline';
  const n = overlay.querySelectorAll('.chart-hline').length;
  el.style.top = (posY!=null ? posY : Math.round(overlay.offsetHeight*(0.3+n*0.1)))+'px';
  _applyLineProps(el, props);
  el.innerHTML = `<div class="line-controls"><span class="ov-grip" title="드래그">⠿</span><span class="ov-close" title="삭제">✕</span></div>`;
  overlay.appendChild(el);
  el.querySelector('.ov-close').onmousedown = (e) => { e.stopPropagation(); el.remove(); };
  _bindDrag(el, overlay, 'hline', '.ov-grip');
  el.oncontextmenu = (e) => { e.preventDefault(); _showProps(el, overlay, 'hline'); };
}

function addVLine(idx, posX, props) {
  const overlay = document.getElementById(`overlay-${idx}`);
  if (!overlay) return;
  const el = document.createElement('div');
  el.className = 'chart-vline'; el.dataset.type = 'vline';
  const n = overlay.querySelectorAll('.chart-vline').length;
  el.style.left = (posX!=null ? posX : Math.round(overlay.offsetWidth*(0.3+n*0.1)))+'px';
  _applyLineProps(el, props, true);
  el.innerHTML = `<div class="line-controls"><span class="ov-grip" title="드래그">⠿</span><span class="ov-close" title="삭제">✕</span></div>`;
  overlay.appendChild(el);
  el.querySelector('.ov-close').onmousedown = (e) => { e.stopPropagation(); el.remove(); };
  _bindDrag(el, overlay, 'vline', '.ov-grip');
  el.oncontextmenu = (e) => { e.preventDefault(); _showProps(el, overlay, 'vline'); };
}

function _applyLineProps(el, props, isVertical) {
  const w = props?.lineWidth || 0.5;
  const c = props?.lineColor || 'var(--rose)';
  if (isVertical) el.style.borderLeft = `${w}px dashed ${c}`;
  else el.style.borderTop = `${w}px dashed ${c}`;
}

// ── Rectangle ──
function addRect(idx, posX, posY, rw, rh, props) {
  const overlay = document.getElementById(`overlay-${idx}`);
  if (!overlay) return;
  const w = overlay.offsetWidth, h = overlay.offsetHeight;
  const el = document.createElement('div');
  el.className = 'chart-rect'; el.dataset.type = 'rect';
  const n = overlay.querySelectorAll('.chart-rect').length;
  el.style.left = (posX!=null?posX:Math.round(w*0.2+n*20))+'px';
  el.style.top = (posY!=null?posY:Math.round(h*0.2+n*20))+'px';
  el.style.width = (rw!=null?rw:Math.round(w*0.4))+'px';
  el.style.height = (rh!=null?rh:Math.round(h*0.4))+'px';
  _applyRectProps(el, props);
  el.innerHTML = `<div class="rect-controls"><span class="ov-grip" title="드래그">⠿</span><span class="ov-close" title="삭제">✕</span></div><span class="rect-resize"></span>`;
  overlay.appendChild(el);
  el.querySelector('.ov-close').onmousedown = (e) => { e.stopPropagation(); el.remove(); };
  _bindDrag(el, overlay, 'rect', '.ov-grip');
  el.querySelector('.rect-resize').onmousedown = (e) => {
    e.stopPropagation(); e.preventDefault();
    _drag = { type:'resize', el, startW:el.offsetWidth, startH:el.offsetHeight, startX:e.clientX, startY:e.clientY };
  };
  el.oncontextmenu = (e) => { e.preventDefault(); _showProps(el, overlay, 'rect'); };
}

function _applyRectProps(el, props) {
  const w = props?.lineWidth || 0.5;
  const c = props?.lineColor || 'var(--rose)';
  const fill = props?.fillColor || 'transparent';
  const opacity = props?.fillOpacity ?? 0.04;
  const rot = props?.rotate || 0;
  el.style.border = `${w}px dashed ${c}`;
  el.style.background = fill === 'transparent' ? `rgba(248,113,113,${opacity})` : _hex2rgba(fill, opacity);
  if (rot) el.style.transform = `rotate(${rot}deg)`;
}

function _hex2rgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ═══ Properties Panel (right-click) ═══
function _showProps(el, overlay, kind) {
  document.querySelectorAll('.ov-props').forEach(p => p.remove());
  const panel = document.createElement('div');
  panel.className = 'ov-props';
  panel.style.pointerEvents = 'auto';

  const elRect = el.getBoundingClientRect();
  const ovRect = overlay.getBoundingClientRect();
  panel.style.left = Math.min(elRect.left - ovRect.left + 20, ovRect.width - 180) + 'px';
  panel.style.top = Math.min(elRect.bottom - ovRect.top + 4, ovRect.height - 200) + 'px';

  let html = '<div class="props-title">속성</div>';

  if (kind === 'hline' || kind === 'vline') {
    const curW = parseFloat(el.style.borderTopWidth || el.style.borderLeftWidth) || 0.5;
    html += `<label>선 굵기 <input type="range" min="0.5" max="5" step="0.5" value="${curW}" onchange="this.parentElement.querySelector('span').textContent=this.value+'px'" oninput="_setProp(this,'lineWidth')"> <span>${curW}px</span></label>`;
    html += `<label>선 색상 <input type="color" value="#f87171" onchange="_setProp(this,'lineColor')"></label>`;
  }

  if (kind === 'rect') {
    const curW = parseFloat(el.style.borderWidth) || 0.5;
    html += `<label>선 굵기 <input type="range" min="0.5" max="5" step="0.5" value="${curW}" onchange="this.parentElement.querySelector('span').textContent=this.value+'px'" oninput="_setProp(this,'lineWidth')"> <span>${curW}px</span></label>`;
    html += `<label>선 색상 <input type="color" value="#f87171" onchange="_setProp(this,'lineColor')"></label>`;
    html += `<label>채우기 <input type="color" value="#f87171" onchange="_setProp(this,'fillColor')"></label>`;
    html += `<label>투명도 <input type="range" min="0" max="1" step="0.05" value="0.04" oninput="_setProp(this,'fillOpacity')"></label>`;
    html += `<button class="props-btn" onclick="_setProp(this,'clearFill')">채우기 제거</button>`;
    html += `<div class="props-row"><button class="props-btn" onclick="_setProp(this,'rotateL')">↺ 좌회전</button><button class="props-btn" onclick="_setProp(this,'rotateR')">↻ 우회전</button></div>`;
  }

  if (kind === 'anno') {
    html += `<label>글자 색상 <input type="color" value="#e8e9f0" onchange="_setProp(this,'textColor')"></label>`;
  }

  html += `<button class="props-btn" onclick="_setProp(this,'copy')">📋 복사</button>`;
  html += `<button class="props-btn close" onclick="this.closest('.ov-props').remove()">닫기</button>`;

  panel.innerHTML = html;
  panel.dataset.targetType = kind;
  panel._target = el;
  overlay.appendChild(panel);

  // Close on outside click
  setTimeout(() => {
    const close = (ev) => {
      if (!panel.contains(ev.target)) { panel.remove(); document.removeEventListener('mousedown', close, true); }
    };
    document.addEventListener('mousedown', close, true);
  }, 50);
}

function _setProp(input, prop) {
  const panel = input.closest('.ov-props');
  const el = panel._target;
  const overlay = panel.parentElement;
  const kind = panel.dataset.targetType;

  if (prop === 'lineWidth') {
    const v = input.value + 'px dashed ' + (el.style.borderTopColor || el.style.borderLeftColor || el.style.borderColor || '#f87171');
    if (kind==='hline') el.style.borderTop = v;
    else if (kind==='vline') el.style.borderLeft = v;
    else el.style.border = v;
  } else if (prop === 'lineColor') {
    const w = parseFloat(el.style.borderTopWidth||el.style.borderLeftWidth||el.style.borderWidth)||0.5;
    const v = `${w}px dashed ${input.value}`;
    if (kind==='hline') el.style.borderTop = v;
    else if (kind==='vline') el.style.borderLeft = v;
    else el.style.border = v;
  } else if (prop === 'fillColor') {
    const opacity = panel.querySelector('input[type=range][oninput*=fillOpacity]')?.value || 0.1;
    el.style.background = _hex2rgba(input.value, opacity);
  } else if (prop === 'fillOpacity') {
    const colorInput = panel.querySelector('input[type=color][onchange*=fillColor]');
    const c = colorInput?.value || '#f87171';
    el.style.background = _hex2rgba(c, input.value);
  } else if (prop === 'clearFill') {
    el.style.background = 'transparent';
  } else if (prop === 'textColor') {
    el.style.color = input.value;
  } else if (prop === 'rotateL') {
    const cur = parseFloat(el.style.transform?.match(/rotate\((-?\d+)/)?.[1]) || 0;
    el.style.transform = `rotate(${cur - 15}deg)`;
  } else if (prop === 'rotateR') {
    const cur = parseFloat(el.style.transform?.match(/rotate\((-?\d+)/)?.[1]) || 0;
    el.style.transform = `rotate(${cur + 15}deg)`;
  } else if (prop === 'copy') {
    const clone = el.cloneNode(true);
    clone.style.left = (parseFloat(el.style.left)||0) + 15 + 'px';
    clone.style.top = (parseFloat(el.style.top)||0) + 15 + 'px';
    overlay.appendChild(clone);
    // Re-bind events
    const idx = parseInt(overlay.id.replace('overlay-',''));
    clone.querySelector('.ov-close').onmousedown = (e) => { e.stopPropagation(); clone.remove(); };
    _bindDrag(clone, overlay, kind, '.ov-grip');
    if (kind==='rect') {
      const rh = clone.querySelector('.rect-resize');
      if (rh) rh.onmousedown = (e) => {
        e.stopPropagation(); e.preventDefault();
        _drag = { type:'resize', el:clone, startW:clone.offsetWidth, startH:clone.offsetHeight, startX:e.clientX, startY:e.clientY };
      };
    }
    clone.oncontextmenu = (e) => { e.preventDefault(); _showProps(clone, overlay, kind); };
    panel.remove();
    showToast('복사되었습니다');
  }
}

// ── Drag engine ──
function _bindDrag(el, overlay, kind, gripSelector) {
  const grip = el.querySelector(gripSelector);
  if (!grip) return;
  grip.onmousedown = (e) => {
    e.preventDefault(); e.stopPropagation();
    _drag = { type:kind, el, overlay, oRect:overlay.getBoundingClientRect(),
      startX:e.clientX, startY:e.clientY, origLeft:parseFloat(el.style.left)||0, origTop:parseFloat(el.style.top)||0 };
    el.classList.add('dragging');
  };
}

document.addEventListener('mousemove', (e) => {
  if (!_drag) return;
  e.preventDefault();
  if (_drag.type==='resize') {
    _drag.el.style.width = Math.max(30, _drag.startW+e.clientX-_drag.startX)+'px';
    _drag.el.style.height = Math.max(20, _drag.startH+e.clientY-_drag.startY)+'px';
    return;
  }
  const {el,oRect,startX,startY,origLeft,origTop,type}=_drag;
  const dx=e.clientX-startX, dy=e.clientY-startY;
  if (type==='hline') el.style.top = Math.max(0,Math.min(origTop+dy,oRect.height-2))+'px';
  else if (type==='vline') el.style.left = Math.max(0,Math.min(origLeft+dx,oRect.width-2))+'px';
  else { el.style.left=Math.max(0,Math.min(origLeft+dx,oRect.width-30))+'px'; el.style.top=Math.max(0,Math.min(origTop+dy,oRect.height-20))+'px'; }
});
document.addEventListener('mouseup', () => { if(_drag&&_drag.el)_drag.el.classList.remove('dragging'); _drag=null; });

// ═══ Save/Load (per chart) ═══
function exportOverlaysJSON(idx) {
  closeAllMenus();
  const ov = document.getElementById(`overlay-${idx}`);
  if (!ov) return;
  const items = [];
  ov.querySelectorAll('[data-type]').forEach(el => {
    const o = {type:el.dataset.type, left:parseFloat(el.style.left)||0, top:parseFloat(el.style.top)||0};
    if (o.type==='anno') { o.text=el.querySelector('.a-text')?.textContent||''; o.color=el.style.color||''; }
    if (o.type==='rect') { o.width=parseFloat(el.style.width)||100; o.height=parseFloat(el.style.height)||60; o.bg=el.style.background||''; o.border=el.style.border||''; o.transform=el.style.transform||''; }
    if (o.type==='hline') o.borderTop=el.style.borderTop||'';
    if (o.type==='vline') o.borderLeft=el.style.borderLeft||'';
    items.push(o);
  });
  if (!items.length) { showToast('저장할 오버레이가 없습니다'); return; }
  const card = document.querySelector(`.rec-card[data-idx="${idx}"]`);
  const title = card?.querySelector('.rec-title')?.textContent||'chart';
  const blob = new Blob([JSON.stringify(items,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`overlay_${title}_${idx}.json`; a.click();
  showToast(`오버레이 ${items.length}개 저장됨`);
}

function importOverlaysJSON(idx) {
  closeAllMenus();
  const ov = document.getElementById(`overlay-${idx}`);
  if (!ov) return;
  const n = ov.querySelectorAll('[data-type]').length;
  if (n>0 && !confirm(`오버레이 ${n}개가 있습니다. 삭제하고 로드하시겠습니까?`)) return;
  ov.querySelectorAll('[data-type]').forEach(el=>el.remove());
  const input=document.createElement('input'); input.type='file'; input.accept='.json'; input.style.display='none';
  document.body.appendChild(input);
  input.onchange=()=>{
    const file=input.files[0]; document.body.removeChild(input); if(!file)return;
    const r=new FileReader();
    r.onload=(evt)=>{
      try {
        const items=JSON.parse(evt.target.result); if(!Array.isArray(items))throw 0;
        items.forEach(it=>{
          if(it.type==='anno') { addAnno(ov,it.left+8,it.top+28,it.text,{color:it.color}); }
          else if(it.type==='hline') { addHLine(idx,it.top); const last=ov.querySelector('.chart-hline:last-child'); if(last&&it.borderTop) last.style.borderTop=it.borderTop; }
          else if(it.type==='vline') { addVLine(idx,it.left); const last=ov.querySelector('.chart-vline:last-child'); if(last&&it.borderLeft) last.style.borderLeft=it.borderLeft; }
          else if(it.type==='rect') { addRect(idx,it.left,it.top,it.width,it.height); const last=ov.querySelector('.chart-rect:last-child'); if(last){if(it.bg)last.style.background=it.bg; if(it.border)last.style.border=it.border; if(it.transform)last.style.transform=it.transform;} }
        });
        showToast(`오버레이 ${items.length}개 로드됨`);
      } catch(e){ showToast('파일을 읽을 수 없습니다'); }
    };
    r.readAsText(file);
  };
  setTimeout(()=>input.click(),50);
}

function clearOverlays(idx) {
  const ov=document.getElementById(`overlay-${idx}`);
  if(!ov)return;
  const n=ov.querySelectorAll('[data-type]').length;
  if(!n){showToast('제거할 오버레이가 없습니다');return;}
  if(!confirm(`오버레이 ${n}개를 모두 제거하시겠습니까?`))return;
  ov.querySelectorAll('[data-type]').forEach(el=>el.remove());
  showToast(`${n}개 제거됨`);
}

function toggleOverlayVisibility(idx, btn) {
  const ov=document.getElementById(`overlay-${idx}`);
  if(!ov)return;
  const hidden=ov.style.display==='none';
  ov.style.display=hidden?'':'none';
  btn.textContent=hidden?'👁':'🚫';
}
