"""
ChartForge Backend — FastAPI API Server
Run: cd backend && uvicorn app.main:app --reload --port 8000
"""

import io, time
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.analyzer import analyze_dataframe

app = FastAPI(title="ChartForge API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 500 * 1024 * 1024


@app.post("/api/analyze")
async def analyze_file(file: UploadFile = File(...)):
    filename = file.filename or "unknown"
    suffix = Path(filename).suffix.lower()
    if suffix not in (".xlsx", ".xls", ".csv", ".tsv"):
        raise HTTPException(400, f"지원하지 않는 형식: {suffix}")

    t0 = time.time()
    try:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(413, f"파일 크기 초과 (최대 {MAX_FILE_SIZE // 1024 // 1024}MB)")
        buf = io.BytesIO(content)

        if suffix == ".csv":
            if len(content) > 50 * 1024 * 1024:
                chunks = pd.read_csv(buf, chunksize=100_000, low_memory=True)
                df = pd.concat(chunks, ignore_index=True)
            else:
                df = pd.read_csv(buf, low_memory=True)
        elif suffix == ".tsv":
            df = pd.read_csv(buf, sep="\t", low_memory=True)
        else:
            df = pd.read_excel(buf, engine="openpyxl")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"파일 파싱 오류: {str(e)}")

    if df.empty:
        raise HTTPException(400, "빈 데이터입니다")

    result = analyze_dataframe(df, filename)
    result["processing_time_ms"] = round((time.time() - t0) * 1000)
    return JSONResponse(result)


@app.get("/api/health")
async def health():
    return {"status": "ok", "max_file_mb": MAX_FILE_SIZE // 1024 // 1024}
