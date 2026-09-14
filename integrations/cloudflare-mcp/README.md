# 클라우드 예약 연결 시험

이 서버는 인증 없는 공개 **읽기 전용 연결 시험**이다. GitHub 인증, 파일 쓰기, 뉴스 수집, 저장소 접근, AI API 호출은 없다. 토큰이나 뉴스 본문을 입력하지 않는다. GitHub 쓰기를 추가할 때는 별도의 인증·권한 설계를 먼저 적용해야 한다.

## Cloudflare 배포

Node.js 22 이상에서 이 디렉터리를 작업 경로로 사용한다.

```sh
npm ci
npm run check
npm run deploy
```

로컬 서버를 켠 뒤 `node smoke.mjs`로 초기 연결·도구 목록·시각·고유 확인값·입력 오류 처리를 확인한다. 배포 후에는 `node smoke.mjs https://실제-worker주소`로 같은 검사를 반복한다. 2026-09-14 로컬 빌드와 이 검사를 통과했다.

2026-09-15 KST 원격 검사도 통과했다. 배포 버전은 `ecf85665-d283-4dd4-89d8-93a32ae66cdb`이며, 서버 응답 시각은 `2026-09-14T21:59:35.375Z`, 확인값은 `83f9c70a-adf0-4a5d-8875-c5c1dca2dcc4`였다. ChatGPT 수동 연결 및 예약 호출은 아직 검증 전이다.

- 서버: https://financial-summary-mcp-probe.lak2577.workers.dev
- ChatGPT 연결 URL: https://financial-summary-mcp-probe.lak2577.workers.dev/mcp
- 배포 인증: 해당 Cloudflare 계정에 한정한 `Workers Scripts:Edit` 사용자 토큰으로 직접 배포했다. Git 연동 자동 배포는 설정하지 않았다. 토큰 값을 저장소에 저장하지 않는다.

Cloudflare 계정 인증이 필요하다. 무료 Workers 요금제를 유지하고 유료 부가 기능은 활성화하지 않는다. 도메인·KV·Durable Objects·데이터베이스 바인딩은 필요하지 않다.

GitHub 연동 배포를 사용하는 경우 저장소는 `Ji-Un-Gil/financialSummary`, 루트 경로는 `integrations/cloudflare-mcp`, 배포 명령은 `npm run deploy`다. 실제 생성된 workers.dev 주소를 사용하고 임의로 계정 서브도메인을 추정하지 않는다.

## ChatGPT 수동 연결 시험

1. 개발자 모드의 맞춤형 앱 추가에서 실제 배포 URL의 `/mcp`를 입력한다.
2. 앱 이름은 `Financial Summary Probe`, 인증은 `No Authentication`을 선택한다. 이 선택은 무권한 시험 서버에만 해당한다.
3. 해당 앱을 선택한 대화에서 `check_cloud_connection`을 marker `manual-test`로 호출하도록 요청한다.
4. 도구 호출 내역과 반환된 `server_time_utc`, `receipt_id`, `github_connected: false`를 확인한다. 답변에 성공했다는 문장만 있으면 시험 통과로 간주하지 않는다.

## 예약 시험

수동 호출 성공 후 같은 앱을 사용할 수 있는 클라우드 대화에서 가까운 미래의 **일회성 예약**을 만든다. 기존 뉴스 예약은 바꾸지 않는다.

> 지정 시각에 Financial Summary Probe의 check_cloud_connection 도구를 marker scheduled-test로 실제 호출하고, 반환된 server_time_utc와 receipt_id를 그대로 결과에 남겨줘. 도구가 제공되지 않거나 호출이 실패하면 그 사실을 보고하고 값을 만들어내지 마. 로컬 컴퓨터는 사용하지 마.

컴퓨터와 로컬 앱을 종료한 상태에서 예약 호출 기록을 확인한다. 이 시험은 MCP 도구의 예약 호출만 검증하며, OAuth 인증 유지·쓰기 승인·GitHub 저장은 다음 단계에서 별도로 시험한다. 예약에서 맞춤형 앱을 사용할 수 없다면 쓰기 서버 구축을 중단하고 그 한계를 기록한다.

## 근거 문서

- [Cloudflare MCP handler](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/)
- [ChatGPT 개발자 모드](https://developers.openai.com/api/docs/guides/developer-mode)
- [Workers 요금](https://developers.cloudflare.com/workers/platform/pricing/)
