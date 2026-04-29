# 블록체인 채굴 게임 v2.0

호서대학교 디지털금융경영학과 블록체인 실습 자료의 웹 구현체.

## 핵심 기능

- 한 번에 **하나의 실습**만 진행 (URL 단순)
- **"새 실습 시작" 버튼** → 모든 데이터 자동 삭제 (학기 12회 반복 부담 없음)
- **PDF Block 1~8** 자동 입력
- **1등 독식 보상** (가장 먼저 정답 제출한 1명만 +1점)
- **Nonce + 해시값** 둘 다 입력해야 정답
- **누적 1위 표시**

## 빠른 시작

[DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md) 참고.

요약:
1. GitHub 업로드
2. Vercel 임포트 (`ADMIN_PASSWORD` 설정)
3. Upstash Marketplace 통합
4. 재배포 → 끝!

## URL

| URL | 용도 |
|---|---|
| `/` | 학생 |
| `/admin` | 교수 (비밀번호 필요) |

## 기술 스택

- Next.js 14 (App Router)
- @upstash/redis
- TypeScript
- Vercel + Upstash

## 환경변수

| 이름 | 비고 |
|---|---|
| `ADMIN_PASSWORD` | 직접 설정 |
| `KV_REST_API_URL` | Upstash 자동 주입 |
| `KV_REST_API_TOKEN` | Upstash 자동 주입 |

## 라이선스

교육 목적 자유 사용.
