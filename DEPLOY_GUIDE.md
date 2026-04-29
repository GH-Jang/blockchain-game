# 블록체인 채굴 게임 - 배포 가이드 (v2.0 / Upstash)

처음부터 깨끗하게 다시 배포하는 가이드입니다.
전체 소요 시간: 약 **20분**.

## 주요 기능

- ✅ 한 번에 **하나의 실습**만 진행 (URL 단순)
- ✅ **"새 실습 시작" 버튼** → 모든 데이터 자동 삭제 (학기 12회 반복 OK)
- ✅ **PDF Block 1~8 자동 입력** (버튼 한 번)
- ✅ **1등 독식 보상**
- ✅ **Nonce + 해시값** 둘 다 입력 검증
- ✅ **누적 1위 표시**
- ✅ **Upstash Redis** (무료, 환경변수 자동 주입)

---

## 단계 0: 기존 배포 정리 (있다면)

이전에 배포한 게 있으면 깨끗이 정리합니다:

1. **Vercel 프로젝트 삭제** (있다면): Vercel 대시보드 → 프로젝트 → Settings → 맨 아래 **Delete Project**
2. **GitHub 저장소 삭제** (있다면): GitHub → 저장소 → Settings → 맨 아래 **Delete this repository**
3. **이전 Supabase/Upstash 데이터베이스 삭제** (있다면): 각 서비스 대시보드에서 삭제

---

## 단계 1: GitHub에 코드 올리기

### 1-1. 새 저장소 생성

1. https://github.com/new 접속
2. **Repository name**: `blockchain-game` 입력
3. **Public** 선택 → **Create repository** 클릭

### 1-2. 코드 업로드

빈 저장소 페이지의 **uploading an existing file** 링크 클릭.
zip을 푼 폴더 안의 **모든 파일**을 통째로 드래그 앤 드롭.
페이지 하단 **Commit changes** 클릭.

---

## 단계 2: Vercel에 배포하기

### 2-1. 프로젝트 임포트

1. https://vercel.com/new 접속
2. GitHub 계정으로 로그인
3. `blockchain-game` 저장소 옆 **Import** 클릭

### 2-2. 환경변수 설정

배포 설정 화면에서 **Environment Variables** 섹션을 펼치고 추가:

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | 원하는 관리자 비밀번호 (예: `hoseo2026`) |

> ⚠️ **이름은 정확히 `ADMIN_PASSWORD`** — 앞뒤 공백/하이픈 없이.

### 2-3. 배포

**Deploy** 클릭. 약 1~2분 후 완료.

---

## 단계 3: Upstash Redis 연결하기

### 3-1. Upstash 만들기

1. Vercel 대시보드 → 방금 배포한 프로젝트 클릭
2. 상단 메뉴 **Storage** 탭 클릭
3. **Marketplace Database Providers** 섹션에서 **Upstash** 행 클릭
4. **Upstash Redis** 선택 → **Continue**

### 3-2. 가입 및 데이터베이스 생성

1. **Vercel managed**로 가입 (별도 가입 불필요)
2. 약관 동의 → **Continue**
3. 데이터베이스 설정:
   - **Database Name**: 자유 (예: `blockchain-game-db`)
   - **Primary Region**: **AP-Northeast (Tokyo)** 또는 **AP-Southeast (Singapore)**
   - **Plan**: **Free**
4. **Create** 클릭

### 3-3. 프로젝트와 연결

생성 완료 후 **Connect Project** 화면:
- 프로젝트 선택: `blockchain-game`
- Environment: **Production** 선택
- **Connect** 클릭

> Upstash가 자동으로 `KV_REST_API_URL`, `KV_REST_API_TOKEN` 등 환경변수를 주입합니다.

### 3-4. 환경변수 확인

1. Vercel 프로젝트 → Settings → **Environments** → **Production**
2. 다음 변수들이 있는지 확인:
   - `ADMIN_PASSWORD` ✓
   - `KV_REST_API_URL` ✓ (Upstash 자동 주입)
   - `KV_REST_API_TOKEN` ✓ (Upstash 자동 주입)
3. **이상한 이름의 변수** (`blockchain-game...` 같은 것) 있으면 모두 **삭제**

### 3-5. 재배포

1. **Deployments** 탭
2. 최근 배포 행 우측 **⋯** → **Redeploy** → 확인
3. 1~2분 후 완료

---

## 단계 4: 사용 시작

### 학생 링크

`https://blockchain-game-xxxx.vercel.app/`

(메인 URL 그대로)

### 관리자 화면

`https://blockchain-game-xxxx.vercel.app/admin`

비밀번호로 로그인.

---

## 매 수업 운영 흐름 (학기 12회 반복)

### 매 수업 시작 시 (1초)

1. 관리자 화면 접속
2. 페이지 상단 주황색 **🆕 새 실습 시작** 버튼 클릭
3. 확인 다이얼로그 2번 → 모든 이전 데이터 삭제
4. 학생들에게 메인 URL 공유

### 라운드 진행 (Block 1~8: PDF 자동)

1. 교수: "Block #N 시작" 버튼 클릭 (PDF 데이터 자동 입력)
2. 학생들: 화면에 자동 표시 → 룩업 + 계산 → nonce + 해시값 제출
3. 교수: 실시간 모니터링
4. 교수: "블록 종료" → 1등 +1점 자동 부여
5. 다음 블록으로 진행

### Block 9 이후 (선택)

PDF 시드 소진 시 자동으로 수동 입력 모드로 전환.

---

## 자주 묻는 질문

### Q. "새 실습 시작" 누르면 정확히 뭐가 삭제되나요?

A. 모든 블록(Block 0 제네시스도), 모든 제출 기록, 모든 학생 점수. 즉시 Block 0(Digital Finance/Jang/P)이 다시 생성되어 새로 시작 준비 완료.

### Q. Upstash Free 한도는?

A. **10,000 명령/일**. 학생 50명이 블록 10개 채굴해도 수천 명령 수준이라 충분합니다.

### Q. 학생 화면이 자동으로 갱신되나요?

A. 2초마다 자동 폴링. 교수가 새 블록 시작하면 학생 화면에 자동으로 뜹니다.

---

## 문제 해결

### "Upstash Redis 연결 실패" 에러

→ Vercel → Settings → Environments → Production에 `KV_REST_API_URL`과 `KV_REST_API_TOKEN`이 있는지 확인. 없으면 단계 3-3 다시 진행. 있는데도 안 되면 재배포.

### 환경변수 이름 오류 (invalid env var)

→ 영문자 외 다른 문자(하이픈, 숫자 시작)가 포함된 변수가 있는 것. Settings → Environments에서 이상한 이름 삭제.

### 학생 화면이 새 블록을 못 받아요

→ 교수가 본 URL과 학생이 본 URL이 같은지 확인 (Production URL 사용).

### 관리자 비밀번호 변경

→ Vercel → Settings → Environments → Production → `ADMIN_PASSWORD` 수정 → 재배포.
