from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import io
import uvicorn
import json

app = FastAPI()

# 전역 변수로 데이터프레임 임시 저장 (실무에서는 세션이나 로컬 캐시/DB 사용 권장)
global_df = pd.DataFrame()

class RecommendRequest(BaseModel):
    selected_cols: List[str]
    col_types: List[str]

@app.post("/api/upload")
async def upload_excel(file: UploadFile = File(...)):
    global global_df
    try:
        contents = await file.read()
        global_df = pd.read_excel(io.BytesIO(contents)) if file.filename.endswith('.xlsx') else pd.read_csv(io.BytesIO(contents))
        
        columns_info = []
        for col in global_df.columns:
            dtype = str(global_df[col].dtype)
            if "datetime" in dtype:
                col_category = "datetime"
            elif "int" in dtype or "float" in dtype:
                col_category = "numerical"
            else:
                col_category = "categorical"
            columns_info.append({"name": col, "type": col_category})
            
        return {"columns": columns_info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 1. 차트 추천 API (Sankey 추가)
@app.post("/api/recommend")
async def recommend_graphs(req: RecommendRequest):
    recommendations = []
    types_count = {
        "categorical": req.col_types.count("categorical"),
        "numerical": req.col_types.count("numerical"),
        "datetime": req.col_types.count("datetime")
    }
    
    # Sankey 다이어그램 추천 조건 (범주형 2개 이상 + 수치형 1개)
    if types_count["categorical"] >= 2 and types_count["numerical"] >= 1:
        recommendations.append("Sankey Diagram")
        recommendations.append("Stacked Bar Chart")
        
    elif types_count["datetime"] == 1 and types_count["numerical"] >= 1:
        recommendations.extend(["Line Chart", "Area Chart"])
        
    elif types_count["categorical"] == 1 and types_count["numerical"] >= 1:
        recommendations.extend(["Bar Chart", "Pie Chart"])
        
    elif types_count["numerical"] >= 2:
        recommendations.extend(["Scatter Plot", "Line Chart"])
        
    return {"recommended_charts": recommendations}

# 2. ECharts 용 데이터 가공 API (Sankey 포맷 처리 포함)
class ChartDataRequest(BaseModel):
    chart_type: str
    cols: List[str] # Sankey의 경우: [source_col, target_col, value_col] 순서

@app.post("/api/chart-data")
async def get_chart_data(req: ChartDataRequest):
    global global_df
    if global_df.empty:
        raise HTTPException(status_code=400, detail="데이터가 업로드되지 않았습니다.")
        
    if req.chart_type == "Sankey Diagram" and len(req.cols) == 3:
        source_col, target_col, value_col = req.cols
        
        # Pandas를 이용해 소스와 타겟 그룹화 및 합산
        grouped = global_df.groupby([source_col, target_col])[value_col].sum().reset_index()
        
        # ECharts Sankey용 Node 추출 (중복 제거된 소스와 타겟 이름들)
        unique_nodes = set(grouped[source_col].unique()).union(set(grouped[target_col].unique()))
        nodes = [{"name": str(node)} for node in unique_nodes]
        
        # ECharts Sankey용 Link 추출
        links = []
        for _, row in grouped.iterrows():
            links.append({
                "source": str(row[source_col]),
                "target": str(row[target_col]),
                "value": float(row[value_col])
            })
            
        return {"nodes": nodes, "links": links}
        
    # 기타 ECharts (Bar, Line 등)용 데이터 가공 로직 추가 필요...
    return {"message": "데이터 처리 방식이 지정되지 않은 차트입니다."}

# 3. Apache ECharts 프론트엔드 UI 예시
@app.get("/", response_class=HTMLResponse)
async def read_index():
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Local ECharts Dashboard</title>
        <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
        <style>
            #main-chart { width: 800px; height: 600px; border: 1px solid #ccc; margin-top: 20px; }
        </style>
    </head>
    <body>
        <h2>Apache ECharts - Sankey Diagram Example</h2>
        <button onclick="drawSankey()">Sankey 차트 렌더링 테스트</button>
        <div id="main-chart"></div>

        <script>
            function drawSankey() {
                var chartDom = document.getElementById('main-chart');
                var myChart = echarts.init(chartDom);
                
                // 실제 서비스에서는 fetch('/api/chart-data', {...}) 를 통해 백엔드에서 아래 데이터를 받아옵니다.
                var mockData = {
                    nodes: [{name: '개발팀'}, {name: '영업팀'}, {name: '인건비'}, {name: '운영비'}, {name: '마케팅비'}],
                    links: [
                        {source: '개발팀', target: '인건비', value: 5000},
                        {source: '개발팀', target: '운영비', value: 1500},
                        {source: '영업팀', target: '인건비', value: 3000},
                        {source: '영업팀', target: '마케팅비', value: 4000}
                    ]
                };

                var option = {
                    title: { text: '부서별 예산 흐름' },
                    tooltip: { trigger: 'item', triggerOn: 'mousemove' },
                    series: {
                        type: 'sankey',
                        layout: 'none',
                        emphasis: { focus: 'adjacency' },
                        data: mockData.nodes,
                        links: mockData.links,
                        lineStyle: { color: 'source', curveness: 0.5 }
                    }
                };

                myChart.setOption(option);
            }
        </script>
    </body>
    </html>
    """
    return html_content

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)