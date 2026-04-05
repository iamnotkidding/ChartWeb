# ChartForge v3

엑셀/CSV 파일을 업로드하면 데이터를 자동 분석하고 40종 차트를 추천하는 웹 서비스입니다.

## 빠른 시작

```bash
# 1. 의존성 설치
pip install -r requirements.txt

# 2. JS 라이브러리 다운로드 (오프라인 사용)
python run.py --setup

# 3. 서버 실행
python run.py
```

브라우저에서 http://localhost:8000 접속

## 프로젝트 구조

```
chartforge/
├── run.py                # 단일 실행 파일 (API + 프론트엔드 서빙)
├── analyzer.py           # 분석 엔진 (40종 차트 추천, 스마트 샘플링)
├── requirements.txt
├── sample_data.xlsx
└── frontend/
    ├── index.html        # 로컬 lib 우선, CDN 폴백
    ├── css/style.css
    ├── js/
    │   ├── config.js     # ECharts 테마, 팔레트
    │   ├── colors.js     # 컬럼/값 색상 시스템
    │   ├── charts.js     # 40종 ECharts 렌더러
    │   ├── overlay.js    # 메모/점선/박스/속성패널/저장
    │   └── app.js        # 비동기 파이프라인, 진행 표시
    └── lib/              # --setup으로 다운로드
        ├── echarts.min.js
        └── echarts-wordcloud.min.js
```

## 실행 옵션

```bash
python run.py                    # 기본 포트 8000
python run.py --port 3000        # 커스텀 포트
python run.py --setup            # JS 라이브러리 다운로드만
python run.py --setup --start    # 다운로드 후 바로 실행
```

## 차트 40종

**기본**: 라인, 계단형, 막대, 가로막대, 누적막대, 그룹막대, 롤리팝, 영역
**비율**: 파이, 도넛, 나이팅게일, 깔때기, 100%누적
**분포**: 산점도, 밀도산점도, 버블, 히스토그램, 박스플롯, 바이올린
**다차원**: 레이더, 평행좌표, 히트맵, 크로스히트맵, 캘린더히트맵
**흐름**: 생키, 트리맵, 선버스트, 테마리버
**시계열**: 캔들스틱
**특수**: 폭포, 게이지, 워드클라우드, KPI대시보드, 기울기, 극좌표
**조합**: 바+라인, 산점도+추세선, 이중Y축, 3중조합, 파이+막대
