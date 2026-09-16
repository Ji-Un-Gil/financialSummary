# 클라우드 GitHub 저장 연결

## 현재 상태

2026-09-16 기준 구현 및 로컬 단위 검증 단계다. 아직 쓰기 서버의 원격 배포, ChatGPT OAuth 연결, 예약 저장 성공을 확인하지 않았다.

- 기존 공개 `financial-summary-mcp-probe`는 연결 확인 전용이며 GitHub에 저장하지 않는다.
- 새 `financial-summary-writer`는 별도 Worker다. OAuth 인증 없이 저장 도구에 접근할 수 없다.
- Cloudflare KV `financial-summary-oauth` 생성 완료. 인증 세션·OAuth 승인 보관 전용이다.
- GitHub fine-grained token 생성은 GitHub의 본인 확인 화면에서 대기 중이다. 실제 토큰은 아직 만들지 않았다.
- Contents 읽기·쓰기와 Metadata 읽기만 선택해 생성 직전까지 갔으나, 브라우저 세션 종료 후 토큰 미발급을 다시 확인했다. 새 Chrome 본인 확인 화면을 유지했다.
- 단위 테스트 8건, 배포 dry-run, 로컬 Workers의 PKCE OAuth 승인·토큰 교환·인증된 MCP 도구 목록·무인증/잘못된 토큰 차단 시험을 통과했다. 원격 쓰기 성공과는 구분한다.
- 공식 GitHub 플러그인의 계정 연결은 했으나 개인 저장소용 GitHub App 설치는 승인하지 않았다. 설치 화면이 Contents 외에 Actions·Workflows·Issues·Pull requests 쓰기 권한을 함께 요구해 최소 권한 경로로 사용하지 않았다.

## 권한과 저장 범위

GitHub fine-grained token은 `Ji-Un-Gil/financialSummary` 하나만 선택하고 **Contents: Read and write**, 자동 포함되는 **Metadata: Read**만 부여한다. 토큰은 Cloudflare Worker의 `GITHUB_TOKEN` secret에만 넣는다. 저장소·문서·채팅·명령행 인자에 기록하지 않는다. 만료일을 기록하고 만료 전에 갱신한다.

Worker의 별도 연결 암호 `AUTH_PASSWORD`는 32바이트 이상의 난수로 생성해 secret으로 보관한다. OAuth 로그인 화면에서 한 번 사용하며 ChatGPT에는 OAuth 토큰이 전달된다. OAuth 구현은 Cloudflare 공식 `@cloudflare/workers-oauth-provider`를 사용한다. PKCE, 세션 쿠키, 동일 출처 POST 검사를 적용한다.

허용 도구:

- `save_connection_test`: `integration-tests/<marker>.json`에 고정 형식 시험 기록을 추가한다.
- `save_daily_summary`: 날짜로 정해지는 `briefings/YYYY/MM/YYYY-MM-DD.md`와 `evidence/YYYY/MM/YYYY-MM-DD.md`를 추가하고 `briefings/README.md` 목록에 고정 형식 행을 덧붙인다. 세 파일은 같은 커밋에 들어간다.

저장소와 브랜치는 코드에 고정된다. 임의 경로, 기존 발행본 덮어쓰기, 삭제, 강제 ref 변경은 제공하지 않는다. 같은 내용 재시도는 추가 커밋 없이 기존 파일 링크를 반환한다. 기존 내용이 다르거나 파일 일부만 있으면 중단한다. 동시 커밋 충돌도 강제 재시도하지 않는다.

문서 형식 검사는 사실 검증을 대신하지 않는다. 작성 에이전트가 원문 대조와 저작권 검토를 수행해야 하며 서버는 검증하지 않았다는 값을 명시적으로 반환한다.

## 검증과 배포

Node.js 22 이상에서 실행한다.

```sh
npm ci
node --test writer.test.mjs
npx wrangler deploy --config wrangler.writer.jsonc --dry-run --outdir dist/writer
node oauth-smoke.mjs
```

`oauth-smoke.mjs`는 가짜 인증정보만 사용하는 로컬 Workers 실행 시험이다. GitHub 저장은 호출하지 않는다. 배포 전 최신 소스를 먼저 번들링한다.

배포는 Workers Scripts 편집 권한만 가진 Cloudflare 토큰으로 진행한다. KV 생성은 대시보드에서 완료했으므로 배포 토큰에 KV 관리 권한을 추가할 필요성을 미리 가정하지 않는다. 실제 API가 추가 권한을 요구하면 필요한 범위를 확인한다.

```sh
npx wrangler deploy --config wrangler.writer.jsonc
npx wrangler secret put GITHUB_TOKEN --config wrangler.writer.jsonc
npx wrangler secret put AUTH_PASSWORD --config wrangler.writer.jsonc
```

위 명령은 대화형 보안 입력을 사용한다. 비밀값을 명령 인자로 붙이지 않는다. 비밀값이 설정되기 전에는 인증 승인이 503으로 차단된다.

예정 MCP 주소: `https://financial-summary-writer.lak2577.workers.dev/mcp` (현재 배포 확인 전).

## 완료 판정

1. 원격 인증 없는 MCP 접근이 401인지 확인한다.
2. ChatGPT 개발자 모드에서 OAuth로 쓰기 앱을 연결한다.
3. 수동 `save_connection_test` 실행 후 반환된 커밋과 원격 파일 내용이 일치하는지 확인한다.
4. 일회성 클라우드 예약에서 별도 marker로 같은 시험을 하고, 사용자 추가 조작 없이 원격 커밋이 생기는지 확인한다.
5. 성공한 경우에만 기존 매일 18:30 Asia/Seoul 예약에 같은 실행 안에서 보고서·검증표를 저장하도록 추가한다. 기존 편집 원칙, 18:00 마감, 불확실한 내용 제외, 부분 수집 표시는 유지한다.
6. 반환된 저장 성공·커밋 URL이 없으면 저장 완료라고 보고하지 않는다. 예약 쓰기 승인이 매번 필요하다면 완전 자동화가 확인되지 않았다고 알린다.
7. 클라우드 저장까지 검증한 후 기존 로컬 중복 예약을 정리한다.

인증 토큰이나 권한 문제가 있는 상태에서 예약 지시만 바꿔 완료로 표시하지 않는다.
