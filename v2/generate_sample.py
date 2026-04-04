import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_large_excel(filename="sample_data.xlsx", num_rows=100000):
    print(f"{num_rows}건의 데이터 생성을 시작합니다...")

    # 1. 기초 데이터 풀 설정
    departments = ['개발팀', '영업팀', '마케팅팀', '인사팀', '경영지원팀', '디자인팀']
    expense_categories = ['인건비', '서버운영비', '마케팅비', '복리후생비', 'R&D비용', '출장비', '비품구입비']
    regions = ['서울', '경기', '부산', '제주', '대전']

    # 2. 랜덤 데이터 생성
    # 날짜 데이터: 2023년 1월 1일부터 365일 중 랜덤
    start_date = datetime(2023, 1, 1)
    dates = [start_date + timedelta(days=np.random.randint(0, 365)) for _ in range(num_rows)]
    
    # 범주형 데이터 (Categorical)
    source_depts = np.random.choice(departments, num_rows)
    target_expenses = np.random.choice(expense_categories, num_rows)
    locations = np.random.choice(regions, num_rows)
    
    # 수치형 데이터 (Numerical)
    # 지출액 (1만 ~ 500만 사이)
    amounts = np.random.randint(10000, 5000000, num_rows)
    # 성과 점수 (1.0 ~ 100.0 사이, 산점도 테스트용)
    performance_scores = np.round(np.random.uniform(1.0, 100.0, num_rows), 1)

    # 3. 데이터프레임 생성
    df = pd.DataFrame({
        '지출일자': dates,
        '담당부서': source_depts,
        '지출항목': target_expenses,
        '발생지역': locations,
        '지출금액': amounts,
        '부서평가점수': performance_scores
    })

    # 4. 파일로 저장
    print("데이터 생성이 완료되었습니다. 파일로 저장 중입니다...")
    
    # CSV로 저장 (대용량 처리에 훨씬 빠르고 적합, 한글 깨짐 방지를 위해 utf-8-sig 사용)
    csv_filename = filename.replace('.xlsx', '.csv')
    df.to_csv(csv_filename, index=False, encoding='utf-8-sig')
    print(f"- CSV 파일 저장 완료: {csv_filename}")
    
    # Excel로 저장 (10만 건 이상 시 시간이 조금 걸릴 수 있습니다)
    # openpyxl 라이브러리가 필요합니다 (pip install openpyxl)
    try:
        df.to_excel(filename, index=False)
        print(f"- Excel 파일 저장 완료: {filename}")
    except Exception as e:
        print(f"Excel 저장 중 오류 발생 (openpyxl 설치 여부 확인): {e}")

if __name__ == "__main__":
    # 데이터 건수를 여기서 조절하세요. 
    # 웹 브라우저 및 FastAPI 성능 한계 테스트를 원하시면 500000 (50만 건) 등으로 올려보세요.
    generate_large_excel("large_test_data.xlsx", num_rows=100000)