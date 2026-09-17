# 클라우드 GitHub 저장 연결

## 현재 상태

2026-09-18 기준 Worker 배포, ChatGPT OAuth 연결, 수동·무인 예약의 GitHub 시험 저장을 확인했다. 매일 18:30 Asia/Seoul 뉴스 예약에는 같은 실행 안에서 보고서와 검증표를 저장하도록 설정했다. 실제 뉴스 보고서의 첫 무인 저장 결과는 아직 확인하지 않았다.

- 기존 공개 `financial-summary-mcp-probe`는 연결 확인 전용이며 GitHub에 저장하지 않는다.
- 새 `financial-summary-writer`는 별도 Worker다. OAuth 인증 없이 저장 도구에 접근할 수 없다.
- Cloudflare KV `financial-summary-oauth` 생성 완료. 인증 세션·OAuth 승인 보관 전용이다.
- GitHub fine-grained token `financial-summary-cloud-writer`를 발급해 Worker secret에 등록했다. 저장소 하나, Contents 읽기·쓰기와 Metadata 읽기만 허용하며 GitHub에 표시된 만료일은 2026-10-17이다.
- 공개 `/health`의 200과 무인증 `/mcp`의 401을 실제 확인했다.
- ChatGPT 앱 `Financial Summary Writer`를 등록했다. 앱 ID는 `asdk_app_6aab1323fa9c8191b1c65ec729bff2a0`이다.
- 인증 폼의 `no-referrer` 설정이 정상 POST의 Origin을 `null`로 만들어 출처 검증과 충돌했다. `same-origin`으로 수정한 뒤 실제 브라우저에서 승인 완료와 ChatGPT 연결을 확인했다. Origin·쿠키·nonce·암호 검사는 유지한다.
- Cloudflare Workers가 `fetch`의 `redirect: 'error'`를 지원하지 않아 첫 저장 호출이 실패했다. `manual`로 수정하고 3xx 응답을 오류 처리하므로 다른 주소로 인증정보를 전달하지 않는다.
- 인증 문제와 GitHub 리디렉션 차단을 포함한 단위 테스트 10건을 통과했다.
- 배포 dry-run, 로컬 Workers의 PKCE OAuth 승인·토큰 교환·인증된 MCP 도구 목록·무인증/잘못된 토큰 차단 시험을 통과했다. 2026-09-18 Node.js 번들 런타임으로 단위 테스트 10건을 다시 실행해 통과했다.
- 공식 GitHub 플러그인의 계정 연결은 했으나 개인 저장소용 GitHub App 설치는 승인하지 않았다. 설치 화면이 Contents 외에 Actions·Workflows·Issues·Pull requests 쓰기 권한을 함께 요구해 최소 권한 경로로 사용하지 않았다.

## 원격 실행 검증 기록

- 수동 시험: `manual-20260917-oauth-fixed`, 커밋 [2f1fbdb](https://github.com/Ji-Un-Gil/financialSummary/commit/2f1fbdb5d5303d496aaae3e10b55d69988a4bfe8). 같은 내용 재시도에서는 추가 커밋 없이 기존 결과를 반환했다.
- 2026-09-17 18:30 KST 일회성 클라우드 예약: `scheduled-20260917-write-01`, 커밋 [7e5260d](https://github.com/Ji-Un-Gil/financialSummary/commit/7e5260d069dd7bd29dc1983f88d50cc164a03a18). 예약 실행 후 추가 승인 조작 없이 시험 파일이 생성되었고 원격 내용을 대조했다. 도구 반환 서버 시각은 `2026-09-17T09:30:35.128Z`였다.
- 2026-09-18 설정 화면 재확인: `Financial Summary Writer`의 권한은 ‘모든 액션 허용’이며 `save_connection_test`, `save_daily_summary` 두 도구가 표시된다. 서버가 제공하는 저장소·경로 제한은 그대로 적용된다.
- 기존 ChatGPT 예약 ‘오늘의 금융 핵심 뉴스’의 매일 오후 6:30 설정과 전체 저장 지시가 유지됨을 확인했다. 예약 ID: `6aa7e4f9b49c8191b599c995bdca5f93`. 보고서 원문 검증, 18:00 마감, 부분 수집 표시, 도구 오류 시 실패 알림을 포함한다.
- 중복 로컬 예약 `automation`은 2026-09-18에 PAUSED로 변경했다. 클라우드 예약을 운영 경로로 사용한다.
- 9월 17일 실제 뉴스 보고서는 사용자 요청으로 로컬에서 작성·푸시했다. 이를 클라우드 뉴스 자동 저장 성공 사례로 계산하지 않는다. 변경된 일일 예약의 첫 뉴스 저장 검증은 9월 18일 실행 이후 가능하다.

토큰 만료일은 2026-10-17이므로 만료 전에 같은 최소 권한으로 갱신하고 Worker secret을 교체해야 한다. 원격 서버는 사실성을 검증하지 않으며, 저장 성공과 내용 검증은 별개다.

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

배포된 MCP 주소: `https://financial-summary-writer.lak2577.workers.dev/mcp`. 인증 연결과 실제 GitHub 저장 성공은 별도로 검증해야 한다.

## 완료 판정

1. 원격 인증 없는 MCP 접근이 401인지 확인한다.
2. ChatGPT 개발자 모드에서 OAuth로 쓰기 앱을 연결한다.
3. 수동 `save_connection_test` 실행 후 반환된 커밋과 원격 파일 내용이 일치하는지 확인한다.
4. 일회성 클라우드 예약에서 별도 marker로 같은 시험을 하고, 사용자 추가 조작 없이 원격 커밋이 생기는지 확인한다.
5. 성공한 경우에만 기존 매일 18:30 Asia/Seoul 예약에 같은 실행 안에서 보고서·검증표를 저장하도록 추가한다. 기존 편집 원칙, 18:00 마감, 불확실한 내용 제외, 부분 수집 표시는 유지한다.
6. 반환된 저장 성공·커밋 URL이 없으면 저장 완료라고 보고하지 않는다. 예약 쓰기 승인이 매번 필요하다면 완전 자동화가 확인되지 않았다고 알린다.
7. 클라우드 저장까지 검증한 후 기존 로컬 중복 예약을 정리한다.

인증 토큰이나 권한 문제가 있는 상태에서 예약 지시만 바꿔 완료로 표시하지 않는다.
