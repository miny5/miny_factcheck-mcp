# 📋 Miny Factcheck MCP

> AI 팩트체크를 위한 MCP 서버 — 8개 전문 도구로 주장을 체계적으로 검증합니다.

**Antigravity**에서 "이 주장이 사실인지 확인해줘"라고 말하면 자동으로 검색·분석·판정까지 수행합니다.

## ✨ 주요 기능

| 도구                        | 설명                          |
| ------------------------- | --------------------------- |
| `generate_search_queries` | 5가지 전략 검색 쿼리 자동 생성          |
| `search_evidence`         | 네이버 + 구글 실시간 웹 검색           |
| `extract_page_content`    | URL에서 본문·날짜·팩트 추출           |
| `score_source_quality`    | 출처 신뢰도 3차원 채점 (200+ 도메인 DB) |
| `check_korean_stats`      | 한국 공식 통계 직접 조회 (KOSIS/한국은행) |
| `detect_duplicates`       | 중복 출처 감지 (Wire-copy 판별)     |
| `calculate_confidence`    | 수학적 신뢰도 계산 + 판정             |
| `format_report`           | 구조화된 팩트체크 보고서 생성            |

---

## 🚀 설치 방법 (3단계)

### 사전 준비

- **Node.js 18+** 설치 필요 → [nodejs.org](https://nodejs.org) 에서 다운로드
- **Antigravity** 설치 필요

### Step 1. 저장소 다운로드

```bash
git clone https://github.com/sieun9711/miny_factcheck-mcp.git
cd miny_factcheck-mcp
```

> 💡 Git이 없다면 GitHub 페이지에서 **Code > Download ZIP**으로 다운로드 후 압축 해제

### Step 2. 자동 설치 실행

```bash
node setup.js
```

이 명령어 하나로 아래가 **자동으로** 완료됩니다:

1. ✅ 패키지 설치 (`npm install`)
2. ✅ TypeScript 빌드 (`npm run build`)
3. ✅ Antigravity MCP 설정에 자동 등록 (`mcp_config.json`)
4. ✅ API 키 입력 안내 (Enter로 건너뛰기 가능)

### Step 3. Antigravity 재시작

설치 후 **Antigravity를 재시작**하면 팩트체크 기능이 활성화됩니다.

```
사용 예시:
> "테슬라가 시가총액 1위라는 주장을 팩트체크해줘"
> "한국 GDP가 세계 10위라는 게 맞아?"
> "이 기사의 숫자가 맞는지 확인해줘: [URL]"
```

---

## 🔑 API 키 설정 (선택사항)

API 키가 없어도 기본 기능은 동작합니다. 키를 등록하면 실시간 검색이 가능해져 더 정확한 결과를 얻을 수 있습니다.

| API                  | 용도        | 발급처                                                          | 비용             |
| -------------------- | --------- | ------------------------------------------------------------ | -------------- |
| 네이버 검색 API           | 뉴스/블로그 검색 | [developers.naver.com](https://developers.naver.com)         | 무료 (일 25,000건) |
| Google Custom Search | 글로벌 웹 검색  | [console.cloud.google.com](https://console.cloud.google.com) | 무료 (일 100건)    |
| KOSIS 통계 API         | 국가통계포털 조회 | [kosis.kr/openapi](https://kosis.kr/openapi)                 | 무료             |
| 한국은행 ECOS API        | 경제통계 조회   | [ecos.bok.or.kr](https://ecos.bok.or.kr)                     | 무료             |

### API 키 나중에 추가/수정하기

`~/.gemini/antigravity/mcp_config.json` 파일을 열어 `env` 부분을 수정하세요:

```json
"miny_factcheck-mcp": {
  "command": "node",
  "args": ["경로/miny_factcheck-mcp/dist/index.js"],
  "env": {
    "NAVER_CLIENT_ID": "여기에_입력",
    "NAVER_CLIENT_SECRET": "여기에_입력",
    "GOOGLE_API_KEY": "여기에_입력",
    "GOOGLE_CSE_ID": "여기에_입력",
    "KOSIS_API_KEY": "여기에_입력",
    "BOK_API_KEY": "여기에_입력"
  }
}
```

---

## 🛠️ 수동 설치 (setup.js 대신)

```bash
# 1. 패키지 설치
npm install

# 2. 빌드
npm run build

# 3. ~/.gemini/antigravity/mcp_config.json 에 위의 설정을 직접 추가
```

---

## 📄 라이선스

MIT License
