#!/usr/bin/env python3
"""
ChartForge — Unified Server
============================
Single entry point: serves both REST API and frontend.

Usage:
  python run.py                   # Start server on port 8000
  python run.py --port 3000       # Start on custom port
  python run.py --setup           # Download JS libraries for offline use
  python run.py --setup --start   # Download libs then start server
"""

import argparse
import io
import sys
import time
import urllib.request
from pathlib import Path

# ─── Setup: Download JS libraries ───

LIB_DIR = Path(__file__).parent / "frontend" / "lib"

LIBS = {
    "echarts.min.js": "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js",
    "echarts-wordcloud.min.js": "https://cdn.jsdelivr.net/npm/echarts-wordcloud@2.1.0/dist/echarts-wordcloud.min.js",
}


def setup_libs():
    """Download ECharts libraries for offline use."""
    LIB_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in LIBS.items():
        dest = LIB_DIR / name
        if dest.exists():
            print(f"  ✓ {name} (already exists, {dest.stat().st_size:,} bytes)")
            continue
        print(f"  ⬇ Downloading {name}...")
        try:
            urllib.request.urlretrieve(url, dest)
            print(f"  ✓ {name} ({dest.stat().st_size:,} bytes)")
        except Exception as e:
            print(f"  ✗ {name} failed: {e}")
            print(f"    → Frontend will use CDN fallback")


# ─── FastAPI Application ───

def create_app():
    import pandas as pd
    from fastapi import FastAPI, File, UploadFile, HTTPException
    from fastapi.responses import JSONResponse, HTMLResponse
    from fastapi.staticfiles import StaticFiles

    # Import analyzer from same directory
    sys.path.insert(0, str(Path(__file__).parent))
    from analyzer import analyze_dataframe

    app = FastAPI(title="ChartForge", version="3.0.0")

    FRONTEND_DIR = Path(__file__).parent / "frontend"
    MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB

    # Serve frontend static files
    app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
    app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
    app.mount("/lib", StaticFiles(directory=str(FRONTEND_DIR / "lib")), name="lib")

    @app.get("/", response_class=HTMLResponse)
    async def index():
        html_path = FRONTEND_DIR / "index.html"
        return HTMLResponse(content=html_path.read_text(encoding="utf-8"))

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
        return {"status": "ok", "version": "3.0.0"}

    return app


# ─── Main ───

def main():
    parser = argparse.ArgumentParser(description="ChartForge — Excel Chart Recommender")
    parser.add_argument("--port", type=int, default=8000, help="Server port (default: 8000)")
    parser.add_argument("--setup", action="store_true", help="Download JS libraries for offline use")
    parser.add_argument("--start", action="store_true", help="Start server after setup")
    args = parser.parse_args()

    if args.setup:
        print("\n📦 ChartForge — Downloading libraries for offline use\n")
        setup_libs()
        print("\n✅ Setup complete!")
        if not args.start:
            print(f"\nRun 'python run.py' to start the server.\n")
            return

    # Check dependencies
    try:
        import fastapi, uvicorn, pandas, openpyxl
    except ImportError as e:
        module = str(e).split("'")[1] if "'" in str(e) else str(e)
        print(f"\n❌ Missing dependency: {module}")
        print(f"\n  pip install -r requirements.txt\n")
        sys.exit(1)

    # Check lib directory
    lib_dir = Path(__file__).parent / "frontend" / "lib"
    if not (lib_dir / "echarts.min.js").exists():
        print("⚠️  Local JS libraries not found. Run 'python run.py --setup' for offline use.")
        print("   Falling back to CDN.\n")

    import uvicorn
    app = create_app()
    port = str(args.port)

    print(f"""
╔══════════════════════════════════════════╗
║  📊 ChartForge v3.0                     ║
║  http://localhost:{port:<25s}║
║                                          ║
║  • API:  /api/analyze (POST)             ║
║  • Docs: /docs (Swagger UI)              ║
║  • Ctrl+C to stop                        ║
╚══════════════════════════════════════════╝
""")
    uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="info")


if __name__ == "__main__":
    main()
