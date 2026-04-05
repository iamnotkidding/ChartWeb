// ChartForge — charts.js
// ECharts renderers for 31 chart types

function buildEChart(domId, rec, preview) {
  const dom = document.getElementById(domId);
  if (!dom) return;
  const chart = echarts.init(dom, 'chartforge');
  chartInstances.push(chart);

  const m = rec.mapping;
  const rows = preview.data;
  const type = rec.chart_type;

  const getCol   = (name) => rows.map(r => r[name]);
  const getNum   = (name) => rows.map(r => r[name] != null ? Number(r[name]) : null);
  const getClean = (name) => getNum(name).filter(v => v !== null && !isNaN(v));
  const limit    = (arr, n=60) => arr.slice(0, n);
  const agg      = (catCol, numCol, labels) => labels.map(l => {
    const vals = rows.filter(r => String(r[catCol]) === String(l)).map(r => Number(r[numCol])).filter(v => !isNaN(v));
    return vals.length ? +(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : 0;
  });

  let option = null;

  // ── LINE ──
  if (type === 'line') {
    const xData = limit(getCol(m.x));
    option = {
      tooltip: { trigger: 'axis' },
      legend: { show: m.y.length > 1, bottom: 0 },
      grid: { top: 20, right: 20, bottom: m.y.length > 1 ? 40 : 20, left: 50, containLabel: true },
      xAxis: { type: 'category', data: xData, axisLabel: { rotate: xData.length > 15 ? 30 : 0 } },
      yAxis: { type: 'value' },
      series: m.y.map((col, i) => ({
        name: col, type: 'line', data: limit(getNum(col)),
        smooth: true, symbol: xData.length > 30 ? 'none' : 'circle', symbolSize: 5,
        lineStyle: { width: 2.5, color: C(col) },
        itemStyle: { color: C(col) },
        areaStyle: null,
      })),
    };
  }

  // ── AREA ──
  else if (type === 'area') {
    const xData = limit(getCol(m.x));
    option = {
      tooltip: { trigger: 'axis' },
      legend: { show: true, bottom: 0 },
      grid: { top: 20, right: 20, bottom: 40, left: 50, containLabel: true },
      xAxis: { type: 'category', data: xData },
      yAxis: { type: 'value' },
      series: m.y.map((col, i) => ({
        name: col, type: 'line', data: limit(getNum(col)),
        smooth: true, symbol: 'none',
        lineStyle: { width: 2, color: C(col) },
        itemStyle: { color: C(col) },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: C(col) + '50' },
          { offset: 1, color: C(col) + '05' },
        ]) },
        stack: 'total',
      })),
    };
  }

  // ── BAR / HORIZONTAL BAR ──
  else if (type === 'bar' || type === 'horizontal_bar') {
    const isHoriz = type === 'horizontal_bar';
    const labels = limit([...new Set(getCol(m.x))], 20);
    const data = agg(m.x, m.y[0], labels);
    const catAxis = { type: 'category', data: labels, axisLabel: { fontSize: 10 } };
    const valAxis = { type: 'value' };
    option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { top: 15, right: 20, bottom: 20, left: isHoriz ? 80 : 50, containLabel: true },
      xAxis: isHoriz ? valAxis : catAxis,
      yAxis: isHoriz ? catAxis : valAxis,
      series: [{
        type: 'bar', data: data.map((v, i) => ({
          value: v,
          itemStyle: { color: new echarts.graphic.LinearGradient(isHoriz ? 0 : 0, isHoriz ? 0 : 1, isHoriz ? 1 : 0, isHoriz ? 0 : 0, [
            { offset: 0, color: VC(m.x, labels[i]) + 'cc' },
            { offset: 1, color: VC(m.x, labels[i]) },
          ]) },
        })),
        barMaxWidth: 40,
        itemStyle: { borderRadius: isHoriz ? [0, 6, 6, 0] : [6, 6, 0, 0] },
      }],
    };
  }

  // ── STACKED BAR ──
  else if (type === 'stacked_bar') {
    const labels = limit([...new Set(getCol(m.x))], 15);
    const groups = [...new Set(getCol(m.group))].slice(0, 8);
    option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { show: true, bottom: 0 },
      grid: { top: 15, right: 20, bottom: 40, left: 50, containLabel: true },
      xAxis: { type: 'category', data: labels },
      yAxis: { type: 'value' },
      series: groups.map((g, i) => ({
        name: g, type: 'bar', stack: 'total',
        data: labels.map(l => {
          const vals = rows.filter(r => String(r[m.x])===String(l) && String(r[m.group])===String(g)).map(r=>Number(r[m.y[0]])).filter(v=>!isNaN(v));
          return vals.length ? +(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : 0;
        }),
        itemStyle: { color: VC(m.group, g), borderRadius: i === groups.length-1 ? [4,4,0,0] : 0 },
        barMaxWidth: 40,
      })),
    };
  }

  // ── PIE ──
  else if (type === 'pie') {
    const labels = [...new Set(getCol(m.x))].slice(0, 7);
    const data = agg(m.x, m.y[0], labels);
    option = {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['0%', '70%'], center: ['40%', '50%'],
        data: labels.map((l, i) => ({ value: data[i], name: l, itemStyle: { color: VC(m.x, l) } })),
        label: { show: true, color: '#8b8d9e', fontSize: 10, formatter: '{b}\n{d}%' },
        emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.3)' } },
        itemStyle: { borderColor: '#12131a', borderWidth: 2, borderRadius: 6 },
      }],
    };
  }

  // ── DOUGHNUT ──
  else if (type === 'doughnut') {
    const labels = [...new Set(getCol(m.x))].slice(0, 7);
    const data = agg(m.x, m.y[0], labels);
    const total = data.reduce((s,v) => s+v, 0);
    option = {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { fontSize: 11 } },
      graphic: {
        type: 'text', left: '33%', top: '45%',
        style: { text: fmtNum(total), fill: '#e8e9f0', fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", textAlign: 'center' },
      },
      series: [{
        type: 'pie', radius: ['48%', '72%'], center: ['40%', '50%'],
        data: labels.map((l, i) => ({ value: data[i], name: l, itemStyle: { color: VC(m.x, l) } })),
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' }, itemStyle: { shadowBlur: 20 } },
        itemStyle: { borderColor: '#12131a', borderWidth: 3, borderRadius: 8 },
      }],
    };
  }

  // ── SCATTER ──
  else if (type === 'scatter') {
    const xVals = getClean(m.x);
    const yVals = getClean(m.y[0]);
    const pts = limit(xVals.map((x, i) => yVals[i] != null ? [x, yVals[i]] : null).filter(Boolean), 300);
    option = {
      tooltip: { formatter: p => `${m.x}: ${p.value[0]}<br>${m.y[0]}: ${p.value[1]}` },
      grid: { top: 20, right: 30, bottom: 40, left: 55, containLabel: true },
      xAxis: { type: 'value', name: m.x, nameLocation: 'center', nameGap: 28, nameTextStyle: { color: '#8b8d9e', fontSize: 11 } },
      yAxis: { type: 'value', name: m.y[0], nameLocation: 'center', nameGap: 42, nameTextStyle: { color: '#8b8d9e', fontSize: 11 } },
      series: [{
        type: 'scatter', data: pts, symbolSize: 8,
        itemStyle: { color: C(m.y[0]), opacity: 0.7, borderColor: C(m.y[0]), borderWidth: 1 },
        emphasis: { itemStyle: { opacity: 1, shadowBlur: 10, shadowColor: C(m.y[0]) + '80' } },
      }],
    };
  }

  // ── BUBBLE ──
  else if (type === 'bubble') {
    const xVals = getClean(m.x);
    const yVals = getClean(m.y[0]);
    const sCol = m.group;
    const sVals = sCol ? getClean(sCol) : xVals.map(() => 10);
    const maxS = Math.max(...sVals, 1);
    const pts = limit(xVals.map((x, i) => {
      if (yVals[i] == null) return null;
      return [x, yVals[i], sVals[i] || 1];
    }).filter(Boolean), 200);
    option = {
      tooltip: { formatter: p => `${m.x}: ${p.value[0]}<br>${m.y[0]}: ${p.value[1]}${sCol ? '<br>'+sCol+': '+p.value[2] : ''}` },
      grid: { top: 20, right: 30, bottom: 40, left: 55, containLabel: true },
      xAxis: { type: 'value', name: m.x, nameLocation: 'center', nameGap: 28 },
      yAxis: { type: 'value', name: m.y[0], nameLocation: 'center', nameGap: 42 },
      series: [{
        type: 'scatter', data: pts,
        symbolSize: (val) => Math.max(6, (val[2] / maxS) * 50),
        itemStyle: { color: new echarts.graphic.RadialGradient(0.4, 0.3, 1, [
          { offset: 0, color: C(m.y[0]) + 'dd' },
          { offset: 1, color: C(m.y[0]) + '40' },
        ]), opacity: 0.85 },
      }],
    };
  }

  // ── HISTOGRAM ──
  else if (type === 'histogram') {
    const vals = getClean(m.x);
    if (!vals.length) return;
    const bins = 25, min = Math.min(...vals), max = Math.max(...vals);
    const step = (max - min) / bins || 1;
    const counts = Array(bins).fill(0);
    vals.forEach(v => { counts[Math.min(Math.floor((v - min) / step), bins - 1)]++; });
    const labels = counts.map((_, i) => fmtNum(min + step * (i + 0.5)));
    option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { top: 15, right: 20, bottom: 25, left: 45, containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { rotate: 30, fontSize: 9 } },
      yAxis: { type: 'value', name: '빈도' },
      series: [{
        type: 'bar', data: counts,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 1, 0, 0, [
            { offset: 0, color: C(m.x) + '40' },
            { offset: 1, color: C(m.x) },
          ]),
          borderRadius: [3, 3, 0, 0],
        },
        barCategoryGap: '2%',
      }],
    };
  }

  // ── BOX PLOT (native) ──
  else if (type === 'box') {
    const cats = [...new Set(getCol(m.x))].slice(0, 10);
    const boxData = cats.map(c => {
      const vals = rows.filter(r => String(r[m.x]) === String(c)).map(r => Number(r[m.y[0]])).filter(v => !isNaN(v)).sort((a,b) => a-b);
      if (!vals.length) return [0,0,0,0,0];
      const q = (p) => { const i = p*(vals.length-1); const f = Math.floor(i); return f===i ? vals[f] : vals[f]+(vals[f+1]-vals[f])*(i-f); };
      return [vals[0], q(0.25), q(0.5), q(0.75), vals[vals.length-1]];
    });
    option = {
      tooltip: { trigger: 'item', formatter: p => {
        const d = p.data;
        return `${p.name}<br>최솟값: ${d[1]}<br>Q1: ${d[2]}<br>중앙값: ${d[3]}<br>Q3: ${d[4]}<br>최댓값: ${d[5]}`;
      }},
      grid: { top: 20, right: 20, bottom: 25, left: 50, containLabel: true },
      xAxis: { type: 'category', data: cats },
      yAxis: { type: 'value', name: m.y[0] },
      series: [{
        type: 'boxplot',
        data: boxData.map((bd, i) => ({
          value: bd,
          itemStyle: { color: VC(m.x, cats[i]) + '30', borderColor: VC(m.x, cats[i]), borderWidth: 2 },
        })),
        emphasis: { itemStyle: { borderWidth: 2.5 } },
      }],
    };
  }

  // ── RADAR ──
  else if (type === 'radar') {
    const labelCol = m.x;
    const axes = m.y.slice(0, 8);
    const entities = [...new Set(getCol(labelCol))].slice(0, 5);
    const axisRanges = {};
    axes.forEach(a => { const v = getClean(a); axisRanges[a] = { min: Math.min(...v), max: Math.max(...v) }; });
    option = {
      tooltip: {},
      legend: { show: true, bottom: 0, textStyle: { fontSize: 10 } },
      radar: {
        indicator: axes.map(a => ({ name: a, max: 100 })),
        shape: 'polygon',
        splitArea: { areaStyle: { color: ['#1a1b2440', '#22232e40'] } },
        axisLine: { lineStyle: { color: '#2a2b3850' } },
        splitLine: { lineStyle: { color: '#2a2b3840' } },
        axisName: { color: '#8b8d9e', fontSize: 10 },
      },
      series: [{
        type: 'radar',
        data: entities.map((ent, i) => {
          const entRows = rows.filter(r => String(r[labelCol]) === String(ent));
          const values = axes.map(a => {
            const vals = entRows.map(r => Number(r[a])).filter(v => !isNaN(v));
            const avg = vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : 0;
            const range = axisRanges[a].max - axisRanges[a].min || 1;
            return Math.round((avg - axisRanges[a].min) / range * 100);
          });
          return {
            name: String(ent), value: values,
            lineStyle: { color: VC(labelCol, ent), width: 2 },
            areaStyle: { color: VC(labelCol, ent) + '25' },
            itemStyle: { color: VC(labelCol, ent) },
          };
        }),
      }],
    };
  }

  // ── HEATMAP (native) ──
  else if (type === 'heatmap') {
    const numCols = preview.columns.filter(c => {
      const v = rows.slice(0, 10).map(r => Number(r[c]));
      return v.some(v2 => !isNaN(v2));
    }).slice(0, 8);

    const data = [];
    let minVal = 1, maxVal = -1;
    numCols.forEach((c1, i) => {
      numCols.forEach((c2, j) => {
        const v1 = rows.map(r => Number(r[c1])).filter(v => !isNaN(v));
        const v2 = rows.map(r => Number(r[c2])).filter(v => !isNaN(v));
        const len = Math.min(v1.length, v2.length);
        const corr = len > 2 ? pearson(v1.slice(0,len), v2.slice(0,len)) : 0;
        data.push([i, j, +corr.toFixed(2)]);
        if (corr < minVal) minVal = corr;
        if (corr > maxVal) maxVal = corr;
      });
    });
    option = {
      tooltip: { formatter: p => `${numCols[p.value[0]]} × ${numCols[p.value[1]]}<br>상관계수: ${p.value[2]}` },
      grid: { top: 10, right: 80, bottom: 50, left: 80, containLabel: true },
      xAxis: { type: 'category', data: numCols, axisLabel: { rotate: 30, fontSize: 9 }, splitArea: { show: true, areaStyle: { color: ['#1a1b2420','#12131a20'] } } },
      yAxis: { type: 'category', data: numCols, axisLabel: { fontSize: 9 }, splitArea: { show: true, areaStyle: { color: ['#1a1b2420','#12131a20'] } } },
      visualMap: {
        min: -1, max: 1, calculable: true,
        orient: 'vertical', right: 0, top: 'center',
        textStyle: { color: '#8b8d9e', fontSize: 10 },
        inRange: { color: ['#f87171', '#2a2b38', '#4f7df9'] },
        itemHeight: 160,
      },
      series: [{
        type: 'heatmap', data: data,
        label: { show: true, color: '#e8e9f0', fontSize: 10, formatter: p => p.value[2].toFixed(2) },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
      }],
    };
  }

  // ── SANKEY ──
  else if (type === 'sankey' && rec.sankey_data) {
    const sd = rec.sankey_data;

    // Calculate threshold: top 30% of link values show labels
    const linkValues = sd.links.map(l => l.value).sort((a, b) => b - a);
    const thresholdIdx = Math.max(1, Math.floor(linkValues.length * 0.3));
    const labelThreshold = linkValues[Math.min(thresholdIdx, linkValues.length - 1)] || 0;

    option = {
      tooltip: {
        trigger: 'item',
        formatter: p => {
          if (p.dataType === 'edge') {
            const s = p.data.source.split(':').slice(1).join(':');
            const t = p.data.target.split(':').slice(1).join(':');
            return `${s} → ${t}<br>값: ${fmtNum(p.data.value)}`;
          }
          return p.data.name.split(':').slice(1).join(':');
        },
      },
      series: [{
        type: 'sankey',
        layout: 'none',
        left: 40, right: 40, top: 15, bottom: 15,
        nodeWidth: 18,
        nodeGap: 10,
        orient: 'horizontal',
        draggable: true,
        focusNodeAdjacency: 'allEdges',
        data: sd.nodes.map(n => {
          const colName = n.name.split(':')[0];
          const val = n.name.split(':').slice(1).join(':');
          return {
            name: n.name,
            itemStyle: { color: VC(colName, val), borderColor: '#12131a', borderWidth: 1 },
            label: { show: true, color: '#e8e9f0', fontSize: 10, formatter: p => p.name.split(':').slice(1).join(':') },
          };
        }),
        links: sd.links.map(l => ({
          source: l.source,
          target: l.target,
          value: l.value,
          lineStyle: {
            color: 'gradient',
            opacity: l.value >= labelThreshold ? 0.45 : 0.25,
          },
          label: {
            show: l.value >= labelThreshold,
            position: 'middle',
            formatter: () => fmtNum(l.value),
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600,
            color: '#e8e9f0',
            textBorderColor: '#0a0b0f',
            textBorderWidth: 2.5,
            padding: [2, 6],
            backgroundColor: '#12131acc',
            borderRadius: 4,
          },
        })),
        emphasis: {
          lineStyle: { opacity: 0.7 },
        },
        lineStyle: { curveness: 0.5 },
        label: { position: 'right' },
      }],
    };
  }

  // ── NIGHTINGALE ROSE ──
  else if (type === 'nightingale') {
    const labels = [...new Set(getCol(m.x))].slice(0, 8);
    const data = agg(m.x, m.y[0], labels);
    option = {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { show: false },
      series: [{
        type: 'pie', roseType: 'area',
        radius: ['18%', '72%'], center: ['50%', '52%'],
        data: labels.map((l, i) => ({ value: data[i], name: l, itemStyle: { color: VC(m.x, l) } })),
        label: { color: '#8b8d9e', fontSize: 10, formatter: '{b}\n{d}%' },
        itemStyle: { borderColor: '#12131a', borderWidth: 2, borderRadius: 6 },
        emphasis: { itemStyle: { shadowBlur: 15, shadowColor: 'rgba(0,0,0,0.4)' } },
      }],
    };
  }

  // ── FUNNEL ──
  else if (type === 'funnel') {
    const labels = [...new Set(getCol(m.x))].slice(0, 8);
    const data = agg(m.x, m.y[0], labels);
    // Sort descending for funnel effect
    const paired = labels.map((l, i) => ({ name: l, value: data[i] })).sort((a, b) => b.value - a.value);
    option = {
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      series: [{
        type: 'funnel',
        left: 60, right: 60, top: 15, bottom: 15,
        width: '70%',
        minSize: '8%', maxSize: '100%',
        sort: 'descending', gap: 4,
        label: { show: true, position: 'inside', color: '#fff', fontSize: 11, fontWeight: 600,
                 formatter: p => `${p.name}\n${fmtNum(p.value)}` },
        data: paired.map((d, i) => ({
          ...d,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: VC(m.x, d.name) + 'cc' },
              { offset: 1, color: VC(m.x, d.name) },
            ]),
            borderColor: '#12131a', borderWidth: 1,
          },
        })),
        emphasis: { label: { fontSize: 13 } },
      }],
    };
  }

  // ── POLAR BAR ──
  else if (type === 'polar_bar') {
    const labels = [...new Set(getCol(m.x))].slice(0, 10);
    const data = agg(m.x, m.y[0], labels);
    option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      angleAxis: { type: 'category', data: labels, axisLabel: { color: '#8b8d9e', fontSize: 9 },
                   axisLine: { lineStyle: { color: '#2a2b3850' } } },
      radiusAxis: { axisLine: { show: false }, axisTick: { show: false },
                    axisLabel: { color: '#8b8d9e', fontSize: 9 },
                    splitLine: { lineStyle: { color: '#2a2b3830' } } },
      polar: { radius: ['12%', '78%'] },
      series: [{
        type: 'bar', coordinateSystem: 'polar',
        data: data.map((v, i) => ({
          value: v,
          itemStyle: { color: VC(m.x, labels[i]) },
        })),
        itemStyle: { borderRadius: 4 },
        emphasis: { itemStyle: { shadowBlur: 10 } },
      }],
    };
  }

  // ── PARALLEL COORDINATES ──
  else if (type === 'parallel') {
    const axes = m.y.slice(0, 8);
    const groupCol = m.group || null;
    const groups = groupCol ? [...new Set(getCol(groupCol))].slice(0, 6) : [null];

    const parallelAxis = axes.map((a, i) => ({
      dim: i, name: a,
      nameTextStyle: { color: '#8b8d9e', fontSize: 9 },
      axisLine: { lineStyle: { color: '#2a2b3860' } },
      axisLabel: { color: '#5a5c6e', fontSize: 8 },
    }));

    const series = groups.map((g, gi) => {
      const filteredRows = g !== null ? rows.filter(r => String(r[groupCol]) === String(g)) : rows;
      const lineData = filteredRows.slice(0, 80).map(r => axes.map(a => {
        const v = Number(r[a]);
        return isNaN(v) ? null : v;
      })).filter(d => d.every(v => v !== null));
      return {
        type: 'parallel', name: g || 'all',
        data: lineData,
        lineStyle: { width: 1.2, opacity: 0.4, color: Pi(gi) },
        emphasis: { lineStyle: { width: 2.5, opacity: 0.9 } },
      };
    });

    option = {
      tooltip: {},
      legend: groupCol ? { show: true, bottom: 0, textStyle: { fontSize: 10 } } : { show: false },
      parallelAxis: parallelAxis,
      parallel: { left: 50, right: 30, top: 25, bottom: groupCol ? 40 : 20 },
      series: series,
    };
  }

  // ── TREEMAP ──
  else if (type === 'treemap' && rec.tree_data) {
    option = {
      tooltip: { formatter: p => `${p.name}<br>값: ${fmtNum(p.value)}` },
      series: [{
        type: 'treemap',
        width: '92%', height: '88%', left: 'center', top: 10,
        roam: false,
        data: rec.tree_data.map((node, i) => ({
          ...node,
          itemStyle: { borderColor: '#12131a', borderWidth: 2, gapWidth: 2, color: Pi(i) },
          label: { show: true, color: '#fff', fontSize: 12, fontWeight: 600 },
          children: (node.children || []).map((child, j) => ({
            ...child,
            itemStyle: { color: Pi(i) + ['ff','cc','aa','88','66'][j % 5] },
            label: { show: true, color: '#fff', fontSize: 10 },
          })),
        })),
        breadcrumb: {
          show: true, bottom: 2, left: 'center',
          itemStyle: { color: '#22232e', borderColor: '#2a2b38', textStyle: { color: '#8b8d9e' } },
        },
        levels: [
          { itemStyle: { borderColor: '#12131a', borderWidth: 3, gapWidth: 3 },
            upperLabel: { show: true, color: '#e8e9f0', fontSize: 11, fontWeight: 700, height: 24, backgroundColor: '#00000040', padding: [2, 6] } },
          { itemStyle: { borderColor: '#12131a80', borderWidth: 1, gapWidth: 1 },
            label: { show: true, color: '#e8e9f0', fontSize: 10 } },
        ],
      }],
    };
  }

  // ── SUNBURST ──
  else if (type === 'sunburst' && rec.tree_data) {
    option = {
      tooltip: { formatter: p => `${p.name}<br>값: ${fmtNum(p.value)}` },
      series: [{
        type: 'sunburst',
        data: rec.tree_data.map((node, i) => ({
          ...node,
          itemStyle: { color: Pi(i) },
          children: (node.children || []).map((child, j) => ({
            ...child,
            itemStyle: { color: Pi(i) + ['dd','bb','99','77'][j % 4] },
          })),
        })),
        radius: ['12%', '88%'],
        label: { color: '#e8e9f0', fontSize: 10, minAngle: 8 },
        itemStyle: { borderColor: '#12131a', borderWidth: 2, borderRadius: 4 },
        emphasis: { itemStyle: { shadowBlur: 15, shadowColor: 'rgba(0,0,0,0.3)' } },
        levels: [
          {},
          { r0: '12%', r: '52%', label: { fontSize: 11, fontWeight: 600 } },
          { r0: '52%', r: '88%', label: { fontSize: 9, align: 'right' } },
        ],
      }],
    };
  }

  // ── THEME RIVER ──
  else if (type === 'themeriver') {
    const timeCol = m.x, valCol = m.y[0], groupCol = m.group;
    const groups = [...new Set(getCol(groupCol))].slice(0, 8);
    const times = [...new Set(getCol(timeCol))].slice(0, 60);
    // Build [[time, value, group], ...]
    const riverData = [];
    times.forEach(t => {
      groups.forEach(g => {
        const vals = rows.filter(r => String(r[timeCol]) === String(t) && String(r[groupCol]) === String(g))
                        .map(r => Number(r[valCol])).filter(v => !isNaN(v));
        const total = vals.length ? vals.reduce((s, v) => s + v, 0) : 0;
        riverData.push([String(t), Math.round(total * 100) / 100, String(g)]);
      });
    });
    option = {
      tooltip: { trigger: 'axis' },
      legend: { show: true, bottom: 0, textStyle: { fontSize: 10 } },
      singleAxis: {
        type: 'category', bottom: 40, top: 20,
        axisLabel: { color: '#8b8d9e', fontSize: 9, rotate: times.length > 20 ? 30 : 0 },
        axisLine: { lineStyle: { color: '#2a2b3850' } },
      },
      series: [{
        type: 'themeRiver',
        data: riverData,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 15, shadowColor: 'rgba(0,0,0,0.3)' } },
        itemStyle: { borderColor: '#12131a', borderWidth: 1 },
        color: CP().slice(0, groups.length),
      }],
    };
  }

  // ── WATERFALL ──
  else if (type === 'waterfall') {
    const labels = [...new Set(getCol(m.x))].slice(0, 12);
    const data = agg(m.x, m.y[0], labels);
    // Calculate waterfall: show cumulative base (transparent) + delta (colored)
    const total = data.reduce((s, v) => s + v, 0);
    const avg = total / data.length;
    // Show as deviations from average
    let cumBase = 0;
    const bases = [], deltas = [], colors = [];
    data.forEach((v, i) => {
      const delta = v - avg;
      if (delta >= 0) {
        bases.push(Math.round(cumBase * 100) / 100);
        deltas.push(Math.round(delta * 100) / 100);
        colors.push(Pi(1)); // green
      } else {
        bases.push(Math.round((cumBase + delta) * 100) / 100);
        deltas.push(Math.round(Math.abs(delta) * 100) / 100);
        colors.push(Pi(3)); // red
      }
      cumBase += delta;
    });
    // Add total bar
    labels.push('합계');
    const finalVal = Math.round(cumBase * 100) / 100;
    bases.push(0);
    deltas.push(Math.abs(finalVal));
    colors.push(finalVal >= 0 ? Pi(0) : Pi(3));

    option = {
      tooltip: {
        formatter: p => {
          if (p.seriesIndex === 0) return '';
          const idx = p.dataIndex;
          return `${labels[idx]}<br>값: ${fmtNum(data[idx] !== undefined ? data[idx] : finalVal)}`;
        },
      },
      grid: { top: 20, right: 20, bottom: 30, left: 55, containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10, rotate: labels.length > 8 ? 25 : 0 } },
      yAxis: { type: 'value' },
      series: [
        { type: 'bar', stack: 'wf', data: bases, itemStyle: { color: 'transparent' }, emphasis: { itemStyle: { color: 'transparent' } } },
        { type: 'bar', stack: 'wf', barMaxWidth: 35,
          data: deltas.map((d, i) => ({
            value: d,
            itemStyle: { color: colors[i], borderRadius: [4, 4, 0, 0] },
          })),
          label: { show: true, position: 'top', color: '#8b8d9e', fontSize: 9,
                   formatter: p => fmtNum(p.value) },
        },
      ],
    };
  }

  // ── GAUGE ──
  else if (type === 'gauge') {
    const vals = getClean(m.x);
    if (!vals.length) return;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const min = Math.min(...vals), max = Math.max(...vals);
    option = {
      series: [{
        type: 'gauge',
        center: ['50%', '58%'], radius: '85%',
        min: Math.floor(min * 0.8), max: Math.ceil(max * 1.1),
        startAngle: 210, endAngle: -30,
        progress: { show: true, width: 14, roundCap: true,
                    itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                      { offset: 0, color: C(m.x) }, { offset: 1, color: Pi(4) }
                    ]) } },
        axisLine: { lineStyle: { width: 14, color: [[1, '#2a2b38']] } },
        axisTick: { show: false },
        splitLine: { length: 8, lineStyle: { width: 2, color: '#3a3b4a' } },
        axisLabel: { distance: 22, color: '#5a5c6e', fontSize: 10 },
        pointer: { show: true, length: '55%', width: 5,
                   itemStyle: { color: C(m.x) },
                   icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z' },
        anchor: { show: true, size: 12, itemStyle: { borderColor: C(m.x), borderWidth: 3, color: '#12131a' } },
        title: { show: true, offsetCenter: [0, '72%'], color: '#8b8d9e', fontSize: 12 },
        detail: {
          valueAnimation: true, offsetCenter: [0, '48%'],
          fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
          color: '#e8e9f0',
          formatter: v => fmtNum(v),
        },
        data: [{ value: Math.round(avg * 100) / 100, name: `${m.x} 평균` }],
      }],
    };
  }

  // ── STEP LINE ──
  else if (type === 'step_line') {
    const xData = limit(getCol(m.x));
    option = {
      tooltip: { trigger: 'axis' },
      grid: { top: 20, right: 20, bottom: 25, left: 50, containLabel: true },
      xAxis: { type: 'category', data: xData, axisLabel: { rotate: xData.length > 15 ? 30 : 0 } },
      yAxis: { type: 'value' },
      series: m.y.map((col, i) => ({
        name: col, type: 'line', step: 'middle',
        data: limit(getNum(col)),
        lineStyle: { width: 2.5, color: C(col) },
        itemStyle: { color: C(col) },
        areaStyle: { color: C(col) + '15' },
      })),
    };
  }

  // ── GROUPED BAR ──
  else if (type === 'grouped_bar') {
    const labels = limit([...new Set(getCol(m.x))], 15);
    const groups = [...new Set(getCol(m.group))].slice(0, 8);
    option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { show: true, bottom: 0 },
      grid: { top: 15, right: 20, bottom: 40, left: 50, containLabel: true },
      xAxis: { type: 'category', data: labels },
      yAxis: { type: 'value' },
      series: groups.map((g, i) => ({
        name: g, type: 'bar',
        data: labels.map(l => {
          const vals = rows.filter(r => String(r[m.x])===String(l) && String(r[m.group])===String(g)).map(r=>Number(r[m.y[0]])).filter(v=>!isNaN(v));
          return vals.length ? +(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : 0;
        }),
        itemStyle: { color: VC(m.group, g), borderRadius: [4,4,0,0] },
        barMaxWidth: 28,
      })),
    };
  }

  // ── LOLLIPOP ──
  else if (type === 'lollipop') {
    const labels = limit([...new Set(getCol(m.x))], 15);
    const data = agg(m.x, m.y[0], labels);
    option = {
      tooltip: { trigger: 'axis' },
      grid: { top: 15, right: 30, bottom: 25, left: 80, containLabel: true },
      yAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10 }, inverse: true },
      xAxis: { type: 'value' },
      series: [
        { type: 'bar', data: data.map((v, i) => ({ value: v, itemStyle: { color: VC(m.x, labels[i]) } })),
          barWidth: 3, barMinHeight: 2, itemStyle: { borderRadius: 2 }, z: 1 },
        { type: 'scatter', data: data.map((v, i) => ({ value: v, itemStyle: { color: VC(m.x, labels[i]), borderColor: '#12131a', borderWidth: 2 } })),
          symbolSize: 14, z: 2,
          label: { show: true, position: 'right', color: '#8b8d9e', fontSize: 10, formatter: p => fmtNum(p.value) } },
      ],
    };
  }

  // ── SCATTER DENSITY ──
  else if (type === 'scatter_density') {
    const xVals = getClean(m.x), yVals = getClean(m.y[0]);
    const pts = limit(xVals.map((x,i) => yVals[i]!=null ? [x,yVals[i]] : null).filter(Boolean), 2000);
    // Simple density: count nearby points
    const gridSize = 20;
    const xMin=Math.min(...pts.map(p=>p[0])), xMax=Math.max(...pts.map(p=>p[0]));
    const yMin=Math.min(...pts.map(p=>p[1])), yMax=Math.max(...pts.map(p=>p[1]));
    const xStep=(xMax-xMin)/gridSize||1, yStep=(yMax-yMin)/gridSize||1;
    const grid = {};
    pts.forEach(([x,y]) => {
      const gx=Math.floor((x-xMin)/xStep), gy=Math.floor((y-yMin)/yStep);
      const k=gx+','+gy; grid[k]=(grid[k]||0)+1;
    });
    const maxD = Math.max(...Object.values(grid), 1);
    const coloredPts = pts.map(([x,y]) => {
      const gx=Math.floor((x-xMin)/xStep), gy=Math.floor((y-yMin)/yStep);
      return [x, y, (grid[gx+','+gy]||1)/maxD];
    });
    option = {
      tooltip: { formatter: p => `${m.x}: ${p.value[0]}<br>${m.y[0]}: ${p.value[1]}` },
      grid: { top: 20, right: 30, bottom: 40, left: 55, containLabel: true },
      xAxis: { type: 'value', name: m.x, nameLocation: 'center', nameGap: 28 },
      yAxis: { type: 'value', name: m.y[0], nameLocation: 'center', nameGap: 42 },
      visualMap: { show: true, min: 0, max: 1, dimension: 2, orient: 'vertical', right: 0, top: 'center',
                   textStyle: { color: '#8b8d9e', fontSize: 9 }, text: ['밀집', '희소'],
                   inRange: { color: [C(m.x)+'30', C(m.x)+'80', C(m.x)] }, itemHeight: 120 },
      series: [{ type: 'scatter', data: coloredPts, symbolSize: 6, itemStyle: { opacity: 0.8 } }],
    };
  }

  // ── VIOLIN (approximated with mirrored area) ──
  else if (type === 'violin') {
    const cats = [...new Set(getCol(m.x))].slice(0, 6);
    const allVals = cats.flatMap(c => rows.filter(r=>String(r[m.x])===String(c)).map(r=>Number(r[m.y[0]])).filter(v=>!isNaN(v)));
    const gMin = Math.min(...allVals), gMax = Math.max(...allVals);
    const binCount = 15, binStep = (gMax - gMin) / binCount || 1;
    const binLabels = Array.from({length: binCount}, (_, i) => fmtNum(gMin + binStep * (i + 0.5)));
    option = {
      tooltip: { trigger: 'axis' },
      legend: { show: true, bottom: 0, textStyle: { fontSize: 10 } },
      grid: { top: 15, right: 20, bottom: 40, left: 50, containLabel: true },
      xAxis: { type: 'category', data: binLabels, axisLabel: { rotate: 30, fontSize: 8 }, name: m.y[0] },
      yAxis: { type: 'value', name: '밀도' },
      series: cats.map((c, ci) => {
        const vals = rows.filter(r=>String(r[m.x])===String(c)).map(r=>Number(r[m.y[0]])).filter(v=>!isNaN(v));
        const counts = Array(binCount).fill(0);
        vals.forEach(v => { const idx = Math.min(Math.floor((v-gMin)/binStep), binCount-1); counts[idx]++; });
        const maxC = Math.max(...counts, 1);
        return {
          name: c, type: 'line', smooth: true, symbol: 'none',
          data: counts.map(v => +(v/maxC).toFixed(3)),
          lineStyle: { width: 2, color: VC(m.x, c) },
          areaStyle: { color: VC(m.x, c) + '25' },
        };
      }),
    };
  }

  // ── CALENDAR HEATMAP ──
  else if (type === 'calendar_heatmap') {
    const timeCol = m.x, valCol = m.y[0];
    const calData = [];
    let minVal = Infinity, maxVal = -Infinity;
    rows.forEach(r => {
      const d = r[timeCol], v = Number(r[valCol]);
      if (d && !isNaN(v)) {
        const ds = String(d).slice(0, 10);
        calData.push([ds, v]);
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    });
    if (calData.length < 5) return;
    const years = [...new Set(calData.map(d => d[0].slice(0,4)))].sort();
    const year = years[0] || '2023';
    option = {
      tooltip: { formatter: p => `${p.value[0]}<br>${valCol}: ${fmtNum(p.value[1])}` },
      visualMap: { min: minVal, max: maxVal, calculable: true, orient: 'horizontal', left: 'center', bottom: 5,
                   textStyle: { color: '#8b8d9e', fontSize: 9 },
                   inRange: { color: ['#12131a', C(valCol) + '60', C(valCol)] } },
      calendar: {
        range: year, top: 30, left: 50, right: 30, bottom: 40,
        cellSize: ['auto', 14],
        itemStyle: { borderWidth: 2, borderColor: '#0a0b0f' },
        dayLabel: { color: '#5a5c6e', fontSize: 9 },
        monthLabel: { color: '#8b8d9e', fontSize: 10 },
        yearLabel: { show: false },
        splitLine: { lineStyle: { color: '#2a2b3860' } },
      },
      series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: calData,
                 emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
    };
  }

  // ── CANDLESTICK ──
  else if (type === 'candlestick') {
    const timeCol = m.x, valCol = m.y[0];
    // Group by time periods and compute open/high/low/close
    const groups = {};
    rows.forEach(r => {
      const t = String(r[timeCol] || '').slice(0, 7); // group by month
      const v = Number(r[valCol]);
      if (t && !isNaN(v)) { if (!groups[t]) groups[t] = []; groups[t].push(v); }
    });
    const sorted = Object.keys(groups).sort();
    const ohlcData = sorted.map(t => {
      const vals = groups[t].sort((a,b)=>a-b);
      return [vals[0], vals[vals.length-1], vals[0], vals[vals.length-1]]; // open, close, low, high
    });
    // Better: use first as open, last as close
    const ohlc2 = sorted.map(t => {
      const vals = groups[t];
      return [vals[0], vals[vals.length-1], Math.min(...vals), Math.max(...vals)];
    });
    option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      grid: { top: 20, right: 20, bottom: 30, left: 50, containLabel: true },
      xAxis: { type: 'category', data: sorted, axisLabel: { fontSize: 9, rotate: sorted.length > 12 ? 30 : 0 } },
      yAxis: { type: 'value', scale: true },
      series: [{
        type: 'candlestick', data: ohlc2,
        itemStyle: {
          color: '#34d399', color0: '#f87171',
          borderColor: '#34d399', borderColor0: '#f87171',
        },
      }],
    };
  }

  // ── COMBO BAR + LINE ──
  else if (type === 'combo_bar_line' && m.y.length >= 2) {
    const barCol = m.y[0], lineCol = m.y[1];
    const isCategory = !rows.some(r => !isNaN(Date.parse(r[m.x])) === false);
    const labels = limit([...new Set(getCol(m.x))], 30);
    const barData = agg(m.x, barCol, labels);
    const lineData = agg(m.x, lineCol, labels);

    option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: '#5a5c6e' } },
      },
      legend: { show: true, bottom: 0, textStyle: { fontSize: 10 } },
      grid: { top: 25, right: 55, bottom: 40, left: 55, containLabel: true },
      xAxis: {
        type: 'category', data: labels,
        axisLabel: { rotate: labels.length > 12 ? 30 : 0, fontSize: 9 },
        axisPointer: { type: 'shadow' },
      },
      yAxis: [
        {
          type: 'value', name: barCol,
          nameTextStyle: { color: C(barCol), fontSize: 10 },
          axisLabel: { color: '#8b8d9e', fontSize: 9 },
          splitLine: { lineStyle: { color: '#2a2b3825', type: 'dashed' } },
        },
        {
          type: 'value', name: lineCol,
          nameTextStyle: { color: C(lineCol), fontSize: 10 },
          axisLabel: { color: '#8b8d9e', fontSize: 9 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: barCol, type: 'bar', yAxisIndex: 0,
          data: barData.map((v, i) => ({
            value: v,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 1, 0, 0, [
                { offset: 0, color: C(barCol) + '40' },
                { offset: 1, color: C(barCol) + 'cc' },
              ]),
            },
          })),
          barMaxWidth: 32,
          itemStyle: { borderRadius: [4, 4, 0, 0] },
        },
        {
          name: lineCol, type: 'line', yAxisIndex: 1,
          data: lineData,
          smooth: true, symbol: labels.length > 20 ? 'none' : 'circle', symbolSize: 6,
          lineStyle: { width: 2.5, color: C(lineCol) },
          itemStyle: { color: C(lineCol), borderColor: '#12131a', borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: C(lineCol) + '25' },
              { offset: 1, color: C(lineCol) + '03' },
            ]),
          },
        },
      ],
    };
  }

  // ── 100% STACKED BAR ──
  else if (type === 'percent_bar') {
    const labels = limit([...new Set(getCol(m.x))], 20);
    const groups = [...new Set(getCol(m.group))].slice(0, 8);
    // Calculate totals per label
    const totals = labels.map(l => {
      return groups.reduce((s, g) => {
        const vals = rows.filter(r => String(r[m.x])===String(l) && String(r[m.group])===String(g)).map(r=>Number(r[m.y[0]])).filter(v=>!isNaN(v));
        return s + (vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0);
      }, 0);
    });
    option = {
      tooltip: { trigger:'axis', axisPointer:{type:'shadow'}, formatter: (params) => {
        let s = params[0].name + '<br>';
        params.forEach(p => { s += `${p.marker} ${p.seriesName}: ${p.value.toFixed(1)}%<br>`; });
        return s;
      }},
      legend: { show:true, bottom:0 },
      grid: { top:15, right:20, bottom:40, left:50, containLabel:true },
      xAxis: { type:'category', data:labels },
      yAxis: { type:'value', max:100, axisLabel:{formatter:'{value}%'} },
      series: groups.map((g, i) => ({
        name:g, type:'bar', stack:'pct',
        data: labels.map((l, li) => {
          const vals = rows.filter(r => String(r[m.x])===String(l) && String(r[m.group])===String(g)).map(r=>Number(r[m.y[0]])).filter(v=>!isNaN(v));
          const avg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
          return totals[li] ? +(avg/totals[li]*100).toFixed(1) : 0;
        }),
        itemStyle: { color: VC(m.group, g) },
        barMaxWidth: 40,
      })),
    };
  }

  // ── WORD CLOUD ──
  else if (type === 'wordcloud') {
    const col = m.x;
    const freq = {};
    rows.forEach(r => { const v = r[col]; if (v != null) freq[String(v)] = (freq[String(v)]||0)+1; });
    const words = Object.entries(freq).map(([name,value]) => ({name, value})).sort((a,b) => b.value-a.value).slice(0, 80);
    const maxV = Math.max(...words.map(w => w.value), 1);
    option = {
      tooltip: { formatter: p => `${p.name}: ${p.value}` },
      series: [{
        type: 'wordCloud',
        shape: 'circle',
        left: 'center', top: 'center', width: '90%', height: '85%',
        sizeRange: [12, 52],
        rotationRange: [-30, 30],
        gridSize: 8,
        textStyle: {
          fontFamily: "'Noto Sans KR', sans-serif",
          fontWeight: 700,
          color: () => PALETTE[Math.floor(Math.random()*PALETTE.length)],
        },
        emphasis: { textStyle: { shadowBlur: 10, shadowColor: '#000' } },
        data: words,
      }],
    };
  }

  // ── CROSS HEATMAP (cat × cat) ──
  else if (type === 'cross_heatmap') {
    const xCats = [...new Set(getCol(m.x))].slice(0, 12);
    const yCats = [...new Set(getCol(m.group))].slice(0, 12);
    const data = []; let minV = Infinity, maxV = -Infinity;
    xCats.forEach((xc, xi) => {
      yCats.forEach((yc, yi) => {
        const vals = rows.filter(r => String(r[m.x])===String(xc) && String(r[m.group])===String(yc)).map(r=>Number(r[m.y[0]])).filter(v=>!isNaN(v));
        const avg = vals.length ? +(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1) : 0;
        data.push([xi, yi, avg]);
        if (avg<minV) minV=avg; if (avg>maxV) maxV=avg;
      });
    });
    option = {
      tooltip: { formatter: p => `${xCats[p.value[0]]} × ${yCats[p.value[1]]}<br>값: ${p.value[2]}` },
      grid: { top:10, right:80, bottom:50, left:80, containLabel:true },
      xAxis: { type:'category', data:xCats, axisLabel:{rotate:30,fontSize:9} },
      yAxis: { type:'category', data:yCats, axisLabel:{fontSize:9} },
      visualMap: { min:minV, max:maxV, calculable:true, orient:'vertical', right:0, top:'center',
        textStyle:{color:'#8b8d9e',fontSize:9}, inRange:{color:['#1a1b24','#4f7df980','#4f7df9']}, itemHeight:140 },
      series: [{ type:'heatmap', data:data,
        label:{show:true,color:'#e8e9f0',fontSize:9,formatter:p=>p.value[2]},
        emphasis:{itemStyle:{shadowBlur:10}} }],
    };
  }

  // ── SLOPE CHART ──
  else if (type === 'slope' && m.y.length >= 2) {
    const cats = [...new Set(getCol(m.x))].slice(0, 10);
    const col1 = m.y[0], col2 = m.y[1];
    option = {
      tooltip: {},
      grid: { top:30, right:80, bottom:20, left:80 },
      xAxis: { type:'category', data:[col1, col2], axisLine:{lineStyle:{color:'#2a2b38'}},
        axisLabel:{fontSize:11,color:'#8b8d9e',fontWeight:600} },
      yAxis: { type:'value', show:false },
      series: cats.map((c, i) => {
        const v1 = rows.filter(r=>String(r[m.x])===String(c)).map(r=>Number(r[col1])).filter(v=>!isNaN(v));
        const v2 = rows.filter(r=>String(r[m.x])===String(c)).map(r=>Number(r[col2])).filter(v=>!isNaN(v));
        const a1 = v1.length ? v1.reduce((s,v)=>s+v,0)/v1.length : 0;
        const a2 = v2.length ? v2.reduce((s,v)=>s+v,0)/v2.length : 0;
        const clr = VC(m.x, c);
        return {
          name:c, type:'line', data:[+a1.toFixed(1), +a2.toFixed(1)],
          lineStyle:{width:2,color:clr}, itemStyle:{color:clr},
          symbol:'circle', symbolSize:10,
          label:{show:true,position:'right',formatter:p=>p.dataIndex===1?c:'',color:clr,fontSize:10},
          endLabel:{show:true,formatter:'{a}',color:clr,fontSize:10},
        };
      }),
    };
  }

  // ── KPI CARDS ──
  else if (type === 'kpi_cards') {
    const numCols = m.y.slice(0, 6);
    // Use custom graphic elements instead of standard chart
    const cardW = 100/(Math.min(numCols.length, 3));
    const graphics = [];
    numCols.forEach((col, i) => {
      const vals = getClean(col);
      const avg = vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : 0;
      const max = vals.length ? Math.max(...vals) : 0;
      const min = vals.length ? Math.min(...vals) : 0;
      const row = Math.floor(i/3), colIdx = i%3;
      const cx = (colIdx+0.5)*100/Math.min(numCols.length,3);
      const cy = numCols.length>3 ? (row===0?30:70) : 50;
      graphics.push(
        {type:'text', left:cx+'%', top:(cy-12)+'%', style:{text:col,fill:'#8b8d9e',fontSize:11,fontWeight:500,textAlign:'center',fontFamily:"'Noto Sans KR'"}},
        {type:'text', left:cx+'%', top:cy+'%', style:{text:fmtNum(avg),fill:'#e8e9f0',fontSize:24,fontWeight:700,textAlign:'center',fontFamily:"'JetBrains Mono',monospace"}},
        {type:'text', left:cx+'%', top:(cy+10)+'%', style:{text:`↓${fmtNum(min)}  ↑${fmtNum(max)}`,fill:'#5a5c6e',fontSize:9,textAlign:'center',fontFamily:"'JetBrains Mono'"}}
      );
    });
    option = { graphic: graphics };
  }

  // ── SCATTER + TRENDLINE ──
  else if (type === 'scatter_trend' && m.y.length >= 1) {
    const xVals = getClean(m.x), yVals = getClean(m.y[0]);
    const pts = limit(xVals.map((x,i) => yVals[i]!=null?[x,yVals[i]]:null).filter(Boolean), 300);
    // Linear regression
    const n = pts.length;
    if (n > 2) {
      const sx=pts.reduce((s,p)=>s+p[0],0), sy=pts.reduce((s,p)=>s+p[1],0);
      const mx=sx/n, my=sy/n;
      let num=0,den=0;
      pts.forEach(p => { num+=(p[0]-mx)*(p[1]-my); den+=(p[0]-mx)**2; });
      const slope = den ? num/den : 0;
      const intercept = my - slope*mx;
      const xMin=Math.min(...pts.map(p=>p[0])), xMax=Math.max(...pts.map(p=>p[0]));
      option = {
        tooltip: { formatter: p => p.seriesType==='scatter' ? `${m.x}: ${p.value[0]}<br>${m.y[0]}: ${p.value[1]}` : '' },
        grid: { top:20, right:30, bottom:40, left:55, containLabel:true },
        xAxis: { type:'value', name:m.x, nameLocation:'center', nameGap:28 },
        yAxis: { type:'value', name:m.y[0], nameLocation:'center', nameGap:42 },
        series: [
          { type:'scatter', data:pts, symbolSize:7,
            itemStyle:{ color:C(m.y[0])+'90', borderColor:C(m.y[0]), borderWidth:1 },
            emphasis:{ itemStyle:{ opacity:1, shadowBlur:8 } } },
          { type:'line', data:[[xMin, slope*xMin+intercept],[xMax, slope*xMax+intercept]],
            symbol:'none', lineStyle:{ color:'#fbbf24', width:2, type:'dashed' },
            tooltip:{ show:false }, markPoint:{ data:[
              { coord:[xMax, slope*xMax+intercept], value:`y=${slope.toFixed(2)}x+${intercept.toFixed(0)}`,
                label:{ show:true, color:'#fbbf24', fontSize:10, fontFamily:"'JetBrains Mono'",
                        position:'left', backgroundColor:'#12131acc', padding:[3,6], borderRadius:4 },
                symbol:'none' }
            ] } },
        ],
      };
    }
  }

  // ── DUAL Y-AXIS ──
  else if (type === 'dual_axis' && m.y.length >= 2) {
    const labels = limit([...new Set(getCol(m.x))], 30);
    const d0 = agg(m.x, m.y[0], labels), d1 = agg(m.x, m.y[1], labels);
    option = {
      tooltip: { trigger:'axis' },
      legend: { show:true, bottom:0 },
      grid: { top:25, right:60, bottom:40, left:60, containLabel:true },
      xAxis: { type:'category', data:labels, axisLabel:{ rotate:labels.length>12?30:0, fontSize:9 } },
      yAxis: [
        { type:'value', name:m.y[0], nameTextStyle:{color:C(m.y[0]),fontSize:10},
          axisLabel:{color:'#8b8d9e',fontSize:9}, splitLine:{lineStyle:{color:'#2a2b3825',type:'dashed'}} },
        { type:'value', name:m.y[1], nameTextStyle:{color:C(m.y[1]),fontSize:10},
          axisLabel:{color:'#8b8d9e',fontSize:9}, splitLine:{show:false} },
      ],
      series: [
        { name:m.y[0], type:'bar', yAxisIndex:0, data:d0,
          itemStyle:{ color:C(m.y[0])+'cc', borderRadius:[4,4,0,0] }, barMaxWidth:28 },
        { name:m.y[1], type:'line', yAxisIndex:1, data:d1, smooth:true,
          lineStyle:{ width:2.5, color:C(m.y[1]) }, itemStyle:{ color:C(m.y[1]) },
          symbol:labels.length>20?'none':'circle', symbolSize:6 },
      ],
    };
  }

  // ── BAR + LINE + AREA (3-combo) ──
  else if (type === 'bar_line_area' && m.y.length >= 3) {
    const labels = limit([...new Set(getCol(m.x))], 30);
    const d0 = agg(m.x, m.y[0], labels);
    const d1 = agg(m.x, m.y[1], labels);
    const d2 = agg(m.x, m.y[2], labels);
    option = {
      tooltip: { trigger:'axis' },
      legend: { show:true, bottom:0 },
      grid: { top:25, right:60, bottom:40, left:60, containLabel:true },
      xAxis: { type:'category', data:labels, axisLabel:{ rotate:labels.length>12?30:0, fontSize:9 } },
      yAxis: [
        { type:'value', name:m.y[0], nameTextStyle:{color:C(m.y[0]),fontSize:10},
          axisLabel:{fontSize:9}, splitLine:{lineStyle:{color:'#2a2b3825',type:'dashed'}} },
        { type:'value', name:m.y[2], nameTextStyle:{color:C(m.y[2]),fontSize:10},
          axisLabel:{fontSize:9}, splitLine:{show:false} },
      ],
      series: [
        { name:m.y[0], type:'bar', yAxisIndex:0, data:d0,
          itemStyle:{ color:new echarts.graphic.LinearGradient(0,1,0,0,[
            {offset:0,color:C(m.y[0])+'40'},{offset:1,color:C(m.y[0])+'cc'}
          ]), borderRadius:[4,4,0,0] }, barMaxWidth:28 },
        { name:m.y[1], type:'line', yAxisIndex:0, data:d1, smooth:true,
          lineStyle:{ width:2.5, color:C(m.y[1]) }, itemStyle:{ color:C(m.y[1]) },
          symbol:'circle', symbolSize:5 },
        { name:m.y[2], type:'line', yAxisIndex:1, data:d2, smooth:true, symbol:'none',
          lineStyle:{ width:1.5, color:C(m.y[2]) },
          areaStyle:{ color:new echarts.graphic.LinearGradient(0,0,0,1,[
            {offset:0,color:C(m.y[2])+'35'},{offset:1,color:C(m.y[2])+'05'}
          ]) } },
      ],
    };
  }

  // ── PIE + BAR COMBO ──
  else if (type === 'pie_bar') {
    const labels = [...new Set(getCol(m.x))].slice(0,7);
    const data = agg(m.x, m.y[0], labels);
    option = {
      tooltip: { trigger:'item' },
      grid: { top:20, right:'8%', bottom:25, left:'55%', containLabel:true },
      xAxis: { type:'value', show:true, splitLine:{lineStyle:{color:'#2a2b3825'}} },
      yAxis: { type:'category', data:labels, axisLabel:{fontSize:10}, inverse:true },
      series: [
        // Pie (left half)
        { type:'pie', radius:['25%','55%'], center:['25%','50%'],
          data:labels.map((l,i) => ({value:data[i],name:l,itemStyle:{color:VC(m.x,l)}})),
          label:{show:true,color:'#8b8d9e',fontSize:9,formatter:'{d}%'},
          itemStyle:{borderColor:'#12131a',borderWidth:2,borderRadius:4},
          emphasis:{itemStyle:{shadowBlur:15}} },
        // Bar (right half)
        { type:'bar', data:data.map((v,i) => ({value:v,itemStyle:{color:VC(m.x,labels[i])}})),
          barMaxWidth:20, itemStyle:{borderRadius:[0,4,4,0]},
          label:{show:true,position:'right',color:'#8b8d9e',fontSize:9,formatter:p=>fmtNum(p.value)} },
      ],
    };
  }

  if (option) {
    option.animationDuration = 800;
    option.animationEasing = 'cubicOut';
    chart.setOption(option);
  }
}


function pearson(x, y) {
  const n = x.length, mx = x.reduce((s,v)=>s+v,0)/n, my = y.reduce((s,v)=>s+v,0)/n;
  let num=0, dx=0, dy=0;
  for (let i=0;i<n;i++) { const a=x[i]-mx, b=y[i]-my; num+=a*b; dx+=a*a; dy+=b*b; }
  const d = Math.sqrt(dx*dy);
  return d ? num/d : 0;
}

function aggregateByCategory(rows, catCol, numCol, labels) {
  return labels.map(l => {
    const vals = rows.filter(r => String(r[catCol])===String(l)).map(r=>Number(r[numCol])).filter(v=>!isNaN(v));
    return vals.length ? +(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : 0;
  });
}
