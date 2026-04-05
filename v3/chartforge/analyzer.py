"""
analyzer.py — Core analysis engine (v2: large-file optimized)
=============================================================
• Smart sampling for datasets > 50K rows
• Chunked CSV/Excel reading
• 30 chart types via Apache ECharts
"""

import io
import math
from typing import Any

import pandas as pd
import numpy as np

# ─── Large File Constants ────────────────────────────────────────────────────
SAMPLE_THRESHOLD  = 50_000   # rows above which we sample for analysis
ANALYSIS_SAMPLE   = 30_000   # sample size for column analysis / correlation
CHART_DATA_LIMIT  = 5_000    # max rows sent to frontend for chart rendering
PREVIEW_LIMIT     = 300      # rows in preview table

# ─── Smart Sampling ─────────────────────────────────────────────────────────

def _smart_sample(df: pd.DataFrame, n: int) -> pd.DataFrame:
    """Stratified-like sample preserving head/tail + random middle."""
    if len(df) <= n:
        return df
    head = df.head(n // 10)
    tail = df.tail(n // 10)
    mid_n = n - len(head) - len(tail)
    mid = df.iloc[len(head):-len(tail)].sample(n=min(mid_n, len(df) - len(head) - len(tail)), random_state=42)
    return pd.concat([head, mid, tail]).drop_duplicates().reset_index(drop=True)


# ─── Column Type Detection ───────────────────────────────────────────────────

def classify_column(series: pd.Series) -> dict:
    info = {
        "name": str(series.name), "dtype": str(series.dtype),
        "null_count": int(series.isnull().sum()),
        "null_pct": round(series.isnull().mean() * 100, 1),
        "unique_count": int(series.nunique()),
        "total_count": len(series), "sample_values": [],
    }
    clean = series.dropna()
    if len(clean) == 0:
        info["semantic_type"] = "empty"
        return info
    info["sample_values"] = [str(v) for v in clean.head(5).tolist()]

    if pd.api.types.is_numeric_dtype(series):
        info["semantic_type"] = "numeric"
        info["stats"] = {
            "mean": _sf(clean.mean()), "median": _sf(clean.median()),
            "std": _sf(clean.std()), "min": _sf(clean.min()), "max": _sf(clean.max()),
        }
        if clean.between(1900, 2100).all() and series.name and any(
            kw in str(series.name).lower() for kw in ["year", "년", "연도"]):
            info["semantic_type"] = "temporal"; info["temporal_grain"] = "year"
        return info

    if pd.api.types.is_datetime64_any_dtype(series):
        info["semantic_type"] = "temporal"
        info["temporal_grain"] = _detect_grain(clean)
        info["stats"] = {"min": str(clean.min()), "max": str(clean.max())}
        return info

    try:
        parsed = pd.to_datetime(clean, format="mixed", errors="coerce")
        if parsed.notna().mean() > 0.8:
            info["semantic_type"] = "temporal"
            info["temporal_grain"] = _detect_grain(parsed.dropna())
            info["stats"] = {"min": str(parsed.min()), "max": str(parsed.max())}
            return info
    except Exception:
        pass

    ratio = info["unique_count"] / len(clean)
    if ratio < 0.05 or info["unique_count"] <= 2:
        info["semantic_type"] = "binary" if info["unique_count"] <= 2 else "low_cardinality"
    elif ratio < 0.3 or info["unique_count"] <= 20:
        info["semantic_type"] = "categorical"
    else:
        info["semantic_type"] = "high_cardinality"
    top = clean.value_counts().head(10).to_dict()
    info["top_values"] = {str(k): int(v) for k, v in top.items()}
    return info

def _sf(val):
    if val is None or (isinstance(val, float) and (math.isnan(val) or math.isinf(val))): return None
    return round(float(val), 4)

def _detect_grain(dt_series):
    if len(dt_series) < 2: return "unknown"
    md = dt_series.sort_values().diff().dropna().dt.days.median()
    if md < 1: return "hourly"
    elif md <= 1: return "daily"
    elif md <= 7: return "weekly"
    elif md <= 31: return "monthly"
    elif md <= 92: return "quarterly"
    else: return "yearly"

# ─── Chart Catalog (30 types) ────────────────────────────────────────────────

CHART_CATALOG = {
    # ── Classic ──
    "line":           {"name":"Line Chart",          "name_ko":"라인 차트",        "icon":"📈","description":"시간에 따른 추세 변화","best_for":"시계열, 트렌드"},
    "step_line":      {"name":"Step Line",           "name_ko":"계단형 차트",      "icon":"📉","description":"이산적 변화를 계단 형태로 표현","best_for":"상태 변화, 이산 이벤트"},
    "bar":            {"name":"Bar Chart",           "name_ko":"막대 차트",        "icon":"📊","description":"카테고리별 값 비교","best_for":"카테고리 비교"},
    "horizontal_bar": {"name":"Horizontal Bar",      "name_ko":"가로 막대 차트",    "icon":"📊","description":"긴 라벨 카테고리 비교","best_for":"긴 이름 카테고리"},
    "stacked_bar":    {"name":"Stacked Bar",         "name_ko":"누적 막대 차트",    "icon":"📊","description":"카테고리별 구성요소 합계","best_for":"구성비 + 합계"},
    "grouped_bar":    {"name":"Grouped Bar",         "name_ko":"그룹 막대 차트",    "icon":"📊","description":"카테고리 내 그룹별 직접 비교","best_for":"그룹 간 직접 비교"},
    "lollipop":       {"name":"Lollipop Chart",      "name_ko":"롤리팝 차트",      "icon":"🍭","description":"막대 대신 점+선으로 깔끔하게 비교","best_for":"순위, 깔끔한 비교"},
    "area":           {"name":"Area Chart",          "name_ko":"영역 차트",        "icon":"🏔️","description":"시간에 따른 누적 변화 강조","best_for":"누적 추세"},
    # ── Proportion ──
    "pie":            {"name":"Pie Chart",           "name_ko":"파이 차트",        "icon":"🥧","description":"전체 대비 비율","best_for":"비율 (≤7 카테고리)"},
    "doughnut":       {"name":"Doughnut Chart",      "name_ko":"도넛 차트",        "icon":"🍩","description":"중앙 요약이 있는 비율","best_for":"비율 + 요약"},
    "nightingale":    {"name":"Nightingale Rose",    "name_ko":"나이팅게일 로즈",    "icon":"🌹","description":"반지름으로 크기 인코딩","best_for":"크기 강조 비율"},
    "funnel":         {"name":"Funnel Chart",        "name_ko":"깔때기 차트",      "icon":"🔻","description":"단계별 감소 흐름","best_for":"전환율, 퍼널"},
    # ── Distribution ──
    "scatter":        {"name":"Scatter Plot",        "name_ko":"산점도",          "icon":"🔵","description":"두 수치 변수 관계","best_for":"상관관계"},
    "bubble":         {"name":"Bubble Chart",        "name_ko":"버블 차트",        "icon":"🫧","description":"3개 수치 변수 관계","best_for":"3차원 관계"},
    "histogram":      {"name":"Histogram",           "name_ko":"히스토그램",       "icon":"📶","description":"수치 데이터 분포","best_for":"분포 분석"},
    "box":            {"name":"Box Plot",            "name_ko":"박스 플롯",        "icon":"📦","description":"사분위수와 이상치","best_for":"분포 비교"},
    "scatter_density":{"name":"Density Scatter",     "name_ko":"밀도 산점도",      "icon":"🔴","description":"점 밀도를 색상으로 표현하는 산점도","best_for":"대용량 분포 패턴"},
    "violin":         {"name":"Violin Plot",         "name_ko":"바이올린 플롯",     "icon":"🎻","description":"분포 형태를 대칭 곡선으로 표현","best_for":"분포 형태 비교"},
    # ── Multi-dimensional ──
    "radar":          {"name":"Radar Chart",         "name_ko":"레이더 차트",      "icon":"🕸️","description":"여러 지표 동시 비교","best_for":"다중 지표 비교"},
    "parallel":       {"name":"Parallel Coordinates","name_ko":"평행 좌표",        "icon":"☰","description":"다차원 수치 패턴 탐색","best_for":"다변량 패턴"},
    "heatmap":        {"name":"Heatmap",             "name_ko":"히트맵",          "icon":"🟥","description":"수치 강도를 색상 표현","best_for":"상관 행렬"},
    "calendar_heatmap":{"name":"Calendar Heatmap",   "name_ko":"캘린더 히트맵",     "icon":"📅","description":"날짜별 수치를 달력 형태로 표현","best_for":"일별 패턴, 계절성"},
    # ── Polar ──
    "polar_bar":      {"name":"Polar Bar",           "name_ko":"극좌표 막대",      "icon":"🎯","description":"원형 좌표 카테고리 비교","best_for":"주기적 데이터"},
    # ── Flow / Hierarchy ──
    "sankey":         {"name":"Sankey Diagram",      "name_ko":"생키 다이어그램",    "icon":"🌊","description":"카테고리 간 흐름 시각화","best_for":"흐름, 전환"},
    "treemap":        {"name":"Treemap",             "name_ko":"트리맵",          "icon":"🟩","description":"계층적 중첩 사각형","best_for":"계층 비율"},
    "sunburst":       {"name":"Sunburst",            "name_ko":"선버스트",         "icon":"☀️","description":"계층적 동심원","best_for":"드릴다운"},
    # ── Temporal ──
    "themeriver":     {"name":"Theme River",         "name_ko":"테마 리버",        "icon":"🏞️","description":"시간 카테고리 흐름","best_for":"토픽 흐름"},
    "candlestick":    {"name":"Candlestick",         "name_ko":"캔들스틱 차트",     "icon":"🕯️","description":"시간별 OHLC/범위를 캔들로 표현","best_for":"가격 변동, 범위 분석"},
    # ── Special ──
    "waterfall":      {"name":"Waterfall Chart",     "name_ko":"폭포 차트",        "icon":"🪜","description":"값의 증감 순차 표시","best_for":"증감 분석"},
    "gauge":          {"name":"Gauge",               "name_ko":"게이지",          "icon":"🎛️","description":"단일 KPI 계기판","best_for":"KPI 모니터링"},
    "combo_bar_line": {"name":"Combo Bar+Line",     "name_ko":"바+라인 조합",     "icon":"📊📈","description":"막대와 라인을 하나의 차트에 조합하여 두 지표를 동시 비교","best_for":"매출 vs 이익률, 수량 vs 평균 등"},
    # ── New v3 ──
    "percent_bar":    {"name":"100% Stacked Bar",   "name_ko":"100% 누적 막대",   "icon":"📊","description":"각 카테고리를 100%로 정규화하여 비율 추세를 비교","best_for":"비율 트렌드, 구성비 변화"},
    "wordcloud":      {"name":"Word Cloud",         "name_ko":"워드 클라우드",     "icon":"☁️","description":"카테고리 값의 빈도를 글자 크기로 표현","best_for":"키워드 빈도, 텍스트 분석"},
    "cross_heatmap":  {"name":"Cross Heatmap",      "name_ko":"크로스 히트맵",     "icon":"🟧","description":"두 카테고리 축의 교차 수치를 색상으로 표현","best_for":"교차 분석, 매트릭스 비교"},
    "slope":          {"name":"Slope Chart",        "name_ko":"기울기 차트",       "icon":"📐","description":"두 시점 간의 순위나 값 변화를 기울기선으로 비교","best_for":"전후 비교, 순위 변동"},
    "kpi_cards":      {"name":"KPI Dashboard",      "name_ko":"KPI 대시보드",     "icon":"🏷️","description":"핵심 수치 지표를 카드 형태로 요약","best_for":"요약 대시보드, 핵심 지표"},
    # ── Composite ──
    "scatter_trend":  {"name":"Scatter + Trend",    "name_ko":"산점도+추세선",     "icon":"📈🔵","description":"산점도에 회귀 추세선을 겹쳐 관계와 방향을 동시에 확인","best_for":"상관분석+예측 방향"},
    "dual_axis":      {"name":"Dual Y-Axis",        "name_ko":"이중축 비교",       "icon":"📊📊","description":"서로 다른 단위의 두 지표를 각각의 Y축으로 겹쳐 비교","best_for":"매출(원) vs 건수(건) 등 단위 상이"},
    "bar_line_area":  {"name":"Bar+Line+Area",      "name_ko":"3중 조합",         "icon":"📊📈🏔️","description":"막대+라인+영역을 한 차트에 조합하여 세 지표를 동시에 비교","best_for":"매출(막대)+이익(라인)+수량추세(영역)"},
    "pie_bar":        {"name":"Pie + Bar",          "name_ko":"파이+막대 조합",    "icon":"🥧📊","description":"전체 비율(파이)과 상세 비교(막대)를 나란히 표시","best_for":"비율 개요 + 상세 비교"},
}

# ─── Recommendation Engine ───────────────────────────────────────────────────

def recommend_charts(columns, df):
    temporals  = [c for c in columns if c["semantic_type"] == "temporal"]
    numerics   = [c for c in columns if c["semantic_type"] == "numeric"]
    categoricals = [c for c in columns if c["semantic_type"] in ("categorical","low_cardinality","binary")]
    high_cards = [c for c in columns if c["semantic_type"] == "high_cardinality"]
    recs = []

    def add(ct, score, x, y, group=None, reason="", **extra):
        if ct not in CHART_CATALOG: return
        r = {**CHART_CATALOG[ct], "chart_type":ct, "score":round(score,2),
             "mapping":{"x":x, "y":y if isinstance(y,list) else [y]}, "reason":reason, **extra}
        if group: r["mapping"]["group"] = group
        recs.append(r)

    # R1: Temporal + Numeric → Line / StepLine / Area
    if temporals and numerics:
        tx = temporals[0]["name"]
        for nc in numerics[:3]:
            add("line", 95, tx, nc["name"], reason=f"시간({tx})에 따른 {nc['name']} 추세")
        if numerics:
            add("step_line", 69, tx, numerics[0]["name"],
                reason=f"{numerics[0]['name']}의 이산적 변화를 계단형으로 표현합니다")
        if len(numerics) >= 2:
            add("area", 82, tx, [n["name"] for n in numerics[:4]], reason="여러 수치의 누적 변화")

    # R1b: Temporal + Numeric → Candlestick (aggregate to OHLC per period)
    if temporals and numerics:
        nc = numerics[0]
        if nc.get("stats") and nc["stats"].get("std") and nc["stats"]["std"] > 0:
            add("candlestick", 63, temporals[0]["name"], nc["name"],
                reason=f"기간별 {nc['name']}의 시가/고가/저가/종가 범위를 캔들로 봅니다")

    # R1c: Daily temporal → Calendar Heatmap
    if temporals and numerics:
        t = temporals[0]
        if t.get("temporal_grain") in ("daily", "weekly"):
            add("calendar_heatmap", 70, t["name"], numerics[0]["name"],
                reason=f"{t['name']}별 {numerics[0]['name']}을 캘린더 히트맵으로 패턴 분석합니다")

    # R2: Categorical + Numeric → Bar / Grouped / Lollipop
    if categoricals and numerics:
        for cat in categoricals[:2]:
            for num in numerics[:2]:
                chart = "horizontal_bar" if cat["unique_count"] > 6 else "bar"
                add(chart, 90, cat["name"], num["name"], reason=f"{cat['name']}별 {num['name']} 비교")
        if len(categoricals) >= 2 and numerics:
            add("stacked_bar", 78, categoricals[0]["name"], numerics[0]["name"],
                group=categoricals[1]["name"],
                reason=f"{categoricals[0]['name']}별 {numerics[0]['name']}을 {categoricals[1]['name']}으로 세분화")
            add("grouped_bar", 77, categoricals[0]["name"], numerics[0]["name"],
                group=categoricals[1]["name"],
                reason=f"{categoricals[0]['name']}별 {numerics[0]['name']}을 {categoricals[1]['name']}으로 그룹 비교")
        if categoricals:
            cat = categoricals[0]
            if cat["unique_count"] <= 15:
                add("lollipop", 69, cat["name"], numerics[0]["name"],
                    reason=f"{cat['name']}별 {numerics[0]['name']}을 롤리팝으로 깔끔하게 비교합니다")

    # R3: Low cardinality → Pie / Doughnut / Nightingale / Polar / Funnel
    for cat in categoricals:
        if 2 <= cat["unique_count"] <= 7 and numerics:
            add("pie", 75, cat["name"], numerics[0]["name"], reason=f"{cat['name']}의 구성비")
            add("doughnut", 73, cat["name"], numerics[0]["name"], reason=f"{cat['name']}별 비율 도넛")
            add("nightingale", 71, cat["name"], numerics[0]["name"], reason=f"{cat['name']}별 나이팅게일 로즈")
            add("polar_bar", 64, cat["name"], numerics[0]["name"], reason=f"{cat['name']}별 극좌표 막대")
            break
    if categoricals and numerics:
        c0 = categoricals[0]
        if 3 <= c0["unique_count"] <= 8:
            add("funnel", 72, c0["name"], numerics[0]["name"], reason=f"{c0['name']}별 깔때기")

    # R4: Numeric × Numeric → Scatter / Density Scatter
    if len(numerics) >= 2:
        done = 0
        for i in range(len(numerics)):
            for j in range(i+1, len(numerics)):
                if done >= 3: break
                corr = _safe_corr(df, numerics[i]["name"], numerics[j]["name"])
                bonus = abs(corr)*10 if corr else 0
                cs = f" (r={corr:.2f})" if corr else ""
                add("scatter", 80+bonus, numerics[i]["name"], numerics[j]["name"],
                    reason=f"{numerics[i]['name']}과 {numerics[j]['name']} 관계{cs}")
                done += 1
        # Density scatter for large datasets
        if len(df) > 1000:
            add("scatter_density", 68, numerics[0]["name"], numerics[1]["name"],
                reason=f"대용량 데이터의 {numerics[0]['name']}×{numerics[1]['name']} 밀도 패턴")

    # R5: 3 numerics → Bubble
    if len(numerics) >= 3:
        add("bubble", 70, numerics[0]["name"], numerics[1]["name"],
            group=numerics[2]["name"],
            reason=f"X={numerics[0]['name']}, Y={numerics[1]['name']}, 크기={numerics[2]['name']}")

    # R6: Histogram / Box / Violin
    for nc in numerics[:3]:
        add("histogram", 65, nc["name"], nc["name"], reason=f"{nc['name']} 분포")
        if categoricals:
            add("box", 68, categoricals[0]["name"], nc["name"],
                reason=f"{categoricals[0]['name']}별 {nc['name']} 분포 비교")
            add("violin", 61, categoricals[0]["name"], nc["name"],
                reason=f"{categoricals[0]['name']}별 {nc['name']} 분포 형태를 바이올린으로 비교")

    # R7: Many numerics → Radar / Parallel / Heatmap
    if len(numerics) >= 3:
        axes = [n["name"] for n in numerics[:8]]
        lc = categoricals[0]["name"] if categoricals else (high_cards[0]["name"] if high_cards else None)
        if lc:
            add("radar", 60, lc, axes, reason=f"여러 지표({', '.join(axes[:3])}...) 동시 비교")
        add("parallel", 57, "rows", axes,
            group=categoricals[0]["name"] if categoricals else None,
            reason=f"{len(axes)}개 수치를 평행 좌표로 패턴 탐색")
    if len(numerics) >= 4:
        add("heatmap", 58, "columns", "columns", reason="상관관계 행렬 시각화")

    # R8: Sankey
    if len(categoricals) >= 2 and numerics:
        for i in range(len(categoricals)):
            for j in range(i+1, min(i+3, len(categoricals))):
                cc = [categoricals[i]["name"], categoricals[j]["name"]]
                sk = _build_sankey_data(df, cc, numerics[0]["name"])
                if sk and len(sk["nodes"])>=3 and len(sk["links"])>=2:
                    recs.append({**CHART_CATALOG["sankey"],"chart_type":"sankey","score":76,
                        "mapping":{"x":cc,"y":[numerics[0]["name"]]},
                        "reason":f"{' → '.join(cc)} 간 흐름","sankey_data":sk})
        if len(categoricals) >= 3:
            cc = [c["name"] for c in categoricals[:3]]
            sk = _build_sankey_data(df, cc, numerics[0]["name"])
            if sk and len(sk["nodes"])>=4:
                recs.append({**CHART_CATALOG["sankey"],"chart_type":"sankey","score":82,
                    "mapping":{"x":cc,"y":[numerics[0]["name"]]},
                    "reason":f"{' → '.join(cc)} 3단계 흐름","sankey_data":sk})

    # R9: Treemap / Sunburst
    if len(categoricals) >= 2 and numerics:
        tree = _build_tree_data(df, [c["name"] for c in categoricals[:2]], numerics[0]["name"])
        if tree and len(tree) >= 2:
            add("treemap", 67, [c["name"] for c in categoricals[:2]], numerics[0]["name"],
                reason=f"계층 구조 비교", tree_data=tree)
            add("sunburst", 63, [c["name"] for c in categoricals[:2]], numerics[0]["name"],
                reason=f"선버스트 드릴다운", tree_data=tree)
    elif categoricals and numerics:
        c0 = categoricals[0]
        if c0["unique_count"] >= 3:
            t = _build_tree_data(df, [c0["name"]], numerics[0]["name"])
            if t: add("treemap", 62, [c0["name"]], numerics[0]["name"],
                       reason=f"{c0['name']}별 트리맵", tree_data=t)

    # R10: ThemeRiver
    if temporals and categoricals and numerics:
        if categoricals[0]["unique_count"] <= 8:
            add("themeriver", 74, temporals[0]["name"], numerics[0]["name"],
                group=categoricals[0]["name"], reason=f"시간별 카테고리 흐름 리버")

    # R11: Waterfall
    if categoricals and numerics:
        c0 = categoricals[0]
        if 3 <= c0["unique_count"] <= 12:
            add("waterfall", 66, c0["name"], numerics[0]["name"], reason=f"증감 폭포 차트")

    # R12: Gauge
    if numerics:
        nc = numerics[0]
        if nc.get("stats"):
            add("gauge", 45, nc["name"], nc["name"], reason=f"{nc['name']} 평균 게이지")

    # R13: Combo Bar+Line
    if len(numerics) >= 2:
        x_col = temporals[0]["name"] if temporals else (categoricals[0]["name"] if categoricals else None)
        if x_col:
            for i in range(min(2, len(numerics))):
                j = (i + 1) % len(numerics)
                if i == j: continue
                add("combo_bar_line", 84, x_col, [numerics[i]["name"], numerics[j]["name"]],
                    reason=f"{x_col}별 {numerics[i]['name']}(막대)와 {numerics[j]['name']}(라인)을 동시 비교합니다")

    # R14: 100% Stacked Bar — proportion trends
    if len(categoricals) >= 2 and numerics:
        add("percent_bar", 76, categoricals[0]["name"], numerics[0]["name"],
            group=categoricals[1]["name"],
            reason=f"{categoricals[0]['name']}별 {categoricals[1]['name']} 비율 추세를 100% 누적으로 봅니다")
    if temporals and categoricals and numerics:
        add("percent_bar", 79, temporals[0]["name"], numerics[0]["name"],
            group=categoricals[0]["name"],
            reason=f"시간별 {categoricals[0]['name']} 구성비 변화를 100% 누적으로 추적합니다")

    # R15: Word Cloud — category frequency
    for cat in categoricals + high_cards:
        if cat["unique_count"] >= 5:
            add("wordcloud", 55, cat["name"], cat["name"],
                reason=f"{cat['name']}의 빈도를 워드 클라우드로 시각화합니다")
            break

    # R16: Cross Heatmap — 2 categoricals + numeric
    if len(categoricals) >= 2 and numerics:
        add("cross_heatmap", 69, categoricals[0]["name"], numerics[0]["name"],
            group=categoricals[1]["name"],
            reason=f"{categoricals[0]['name']} × {categoricals[1]['name']} 교차 테이블을 히트맵으로 봅니다")

    # R17: Slope Chart — categorical + 2 numerics
    if categoricals and len(numerics) >= 2:
        add("slope", 62, categoricals[0]["name"], [numerics[0]["name"], numerics[1]["name"]],
            reason=f"{categoricals[0]['name']}별 {numerics[0]['name']} vs {numerics[1]['name']} 변화를 기울기로 비교")

    # R18: KPI Cards
    if len(numerics) >= 2:
        add("kpi_cards", 50, "summary", [n["name"] for n in numerics[:6]],
            reason=f"핵심 수치 {len(numerics[:6])}개를 KPI 카드로 요약합니다")

    # ═══ R19-22: Composite / Combination Charts ═══

    # R19: Scatter + Trendline
    if len(numerics) >= 2:
        corr = _safe_corr(df, numerics[0]["name"], numerics[1]["name"])
        if corr is not None:
            add("scatter_trend", 83, numerics[0]["name"], numerics[1]["name"],
                reason=f"{numerics[0]['name']}×{numerics[1]['name']} 산점도에 추세선으로 상관 방향을 표시합니다 (r={corr:.2f})")

    # R20: Dual Y-Axis — two numerics with very different scales
    if len(numerics) >= 2:
        x_col = temporals[0]["name"] if temporals else (categoricals[0]["name"] if categoricals else None)
        if x_col:
            n0, n1 = numerics[0], numerics[1]
            s0, s1 = n0.get("stats",{}), n1.get("stats",{})
            if s0.get("max") and s1.get("max"):
                ratio = max(s0["max"],s1["max"]) / max(min(s0["max"],s1["max"]),0.01)
                if ratio > 3:
                    add("dual_axis", 81, x_col, [n0["name"], n1["name"]],
                        reason=f"{n0['name']}(좌축)과 {n1['name']}(우축)을 스케일 분리하여 겹쳐 비교합니다")

    # R21: Bar + Line + Area — 3 numerics combined
    if len(numerics) >= 3 and (temporals or categoricals):
        x_col = temporals[0]["name"] if temporals else categoricals[0]["name"]
        add("bar_line_area", 79, x_col, [numerics[0]["name"], numerics[1]["name"], numerics[2]["name"]],
            reason=f"{numerics[0]['name']}(막대)+{numerics[1]['name']}(라인)+{numerics[2]['name']}(영역) 3중 조합")

    # R22: Pie + Bar combo — category + numeric
    if categoricals and numerics:
        cat = categoricals[0]
        if 3 <= cat["unique_count"] <= 7:
            add("pie_bar", 74, cat["name"], numerics[0]["name"],
                reason=f"{cat['name']}의 {numerics[0]['name']} 비율(파이)과 값 비교(막대)를 나란히 표시")

    # ── Diversity selection ──
    recs.sort(key=lambda r: r["score"], reverse=True)
    seen, unique = set(), []
    for r in recs:
        xk = tuple(r["mapping"]["x"]) if isinstance(r["mapping"]["x"], list) else r["mapping"]["x"]
        k = (r["chart_type"], xk, tuple(r["mapping"]["y"]))
        if k not in seen: seen.add(k); unique.append(r)
    tb = {}
    for r in unique:
        if r["chart_type"] not in tb: tb[r["chart_type"]] = r
    diverse = sorted(tb.values(), key=lambda r: r["score"], reverse=True)
    ds = set(id(r) for r in diverse)
    for r in unique:
        if id(r) not in ds: diverse.append(r); ds.add(id(r))
    return diverse[:40]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _safe_corr(df, c1, c2):
    try:
        v = df[c1].corr(df[c2])
        return round(v, 4) if not (math.isnan(v) or math.isinf(v)) else None
    except: return None

def _build_sankey_data(df, cats, ncol, mx=10):
    try:
        cl = df[cats+[ncol]].dropna()
        if len(cl)<2: return None
        ns, lm = set(), {}
        for si in range(len(cats)-1):
            sc,tc = cats[si],cats[si+1]
            st = cl.groupby(sc)[ncol].sum().nlargest(mx).index.tolist()
            tt = cl.groupby(tc)[ncol].sum().nlargest(mx).index.tolist()
            sub = cl[cl[sc].isin(st) & cl[tc].isin(tt)]
            for _,row in sub.groupby([sc,tc])[ncol].sum().reset_index().iterrows():
                sn,tn,v = f"{sc}:{row[sc]}",f"{tc}:{row[tc]}",float(row[ncol])
                if v<=0: continue
                ns.update([sn,tn]); lm[(sn,tn)] = lm.get((sn,tn),0)+v
        if not lm: return None
        return {"nodes":[{"name":n} for n in sorted(ns)],
                "links":[{"source":s,"target":t,"value":round(v,2)} for (s,t),v in sorted(lm.items(),key=lambda x:-x[1])]}
    except: return None

def _build_tree_data(df, cats, ncol, mx=12):
    try:
        cl = df[cats+[ncol]].dropna()
        if len(cl)<2: return None
        if len(cats)==1:
            agg = cl.groupby(cats[0])[ncol].sum().nlargest(mx)
            return [{"name":str(k),"value":round(float(v),2)} for k,v in agg.items()]
        top = cl.groupby(cats[0])[ncol].sum().nlargest(mx).index.tolist()
        tree = []
        for p in top:
            sub = cl[cl[cats[0]]==p]
            ch = sub.groupby(cats[1])[ncol].sum().nlargest(mx)
            children = [{"name":str(k),"value":round(float(v),2)} for k,v in ch.items()]
            if children: tree.append({"name":str(p),"children":children})
        return tree if tree else None
    except: return None


# ─── Data Preview (optimized) ────────────────────────────────────────────────

def build_preview(df, max_rows=PREVIEW_LIMIT):
    pdf = df.head(max_rows).copy()
    for col in pdf.columns:
        if pd.api.types.is_datetime64_any_dtype(pdf[col]):
            pdf[col] = pdf[col].dt.strftime("%Y-%m-%d")
        pdf[col] = pdf[col].where(pdf[col].notna(), None)
    records = []
    for _, row in pdf.iterrows():
        rec = {}
        for col in pdf.columns:
            v = row[col]
            if v is None or (isinstance(v, float) and math.isnan(v)): rec[str(col)] = None
            elif isinstance(v, (np.integer,)): rec[str(col)] = int(v)
            elif isinstance(v, (np.floating,)): rec[str(col)] = round(float(v), 6)
            else: rec[str(col)] = str(v) if not isinstance(v, (str,int,float,bool)) else v
        records.append(rec)
    return {"columns":[str(c) for c in df.columns], "row_count":len(df), "preview_rows":len(records), "data":records}


# ─── Full Pipeline (large-file aware) ────────────────────────────────────────

def analyze_dataframe(df, filename="data.xlsx"):
    total_rows = len(df)
    df = df.dropna(how="all", axis=1).dropna(how="all", axis=0)

    # Sample for analysis if large
    if len(df) > SAMPLE_THRESHOLD:
        analysis_df = _smart_sample(df, ANALYSIS_SAMPLE)
        sampled = True
    else:
        analysis_df = df
        sampled = False

    col_analysis = [classify_column(analysis_df[col]) for col in analysis_df.columns]
    # Fix total_count to real count
    for ca in col_analysis:
        ca["total_count"] = len(df)

    charts = recommend_charts(col_analysis, analysis_df)

    # Limit data sent for chart rendering
    chart_df = _smart_sample(df, CHART_DATA_LIMIT) if len(df) > CHART_DATA_LIMIT else df
    preview = build_preview(chart_df)

    result = {
        "filename": filename,
        "shape": {"rows": total_rows, "columns": df.shape[1]},
        "column_analysis": col_analysis,
        "recommendations": charts,
        "preview": preview,
    }
    if sampled:
        result["sampling_info"] = {
            "sampled": True,
            "original_rows": total_rows,
            "analysis_sample": len(analysis_df),
            "chart_data_rows": len(chart_df),
        }
    return result
