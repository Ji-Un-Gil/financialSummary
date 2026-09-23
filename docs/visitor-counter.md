# 방문·조회 집계

- Cloudflare Workers + SQLite Durable Object에 공유 집계를 저장한다. 기존 뉴스 저장 서버 및 GitHub 쓰기 자격증명과 분리한다.
- 오늘 방문: 한국시간 하루에 같은 브라우저 식별자는 한 번. 누적 방문: 일별 방문 수의 합계이며 실제 사람 수와 같지 않다.
- 게시물 조회: 게시물별로 같은 브라우저를 하루 한 번 계산한 값의 누계. 검증표는 조회수에 포함하지 않는다.
- 브라우저에는 날짜와 무작위 ID만 저장한다. 서버 앱은 IP·이름·위치·브라우저 지문을 저장하지 않는다. 전날 ID 기록은 다음 집계 요청에서 삭제하고 합계는 유지한다. Cloudflare 자체 네트워크 처리는 해당 서비스 정책을 따른다.
- 브라우저/기기 변경, 저장공간 삭제·차단, 비공개 모드는 중복 집계 가능하다. 공개 카운터는 조작 방지나 감사용 통계가 아니며, 자동화 요청을 완전히 구별하지 않는다.
- 도입 이전 방문 수는 복원하지 않는다. 오류 때 가짜 숫자나 0을 표시하지 않고 일시 확인 불가로 안내한다. 글 읽기는 집계 서버 장애와 무관하게 동작한다.
- 무료 Workers 및 SQLite Durable Objects 범위로 운영한다. 무료 한도 초과 시 집계가 중단될 수 있다. 유료 요금제로 변경하지 않는다. [Cloudflare 무료 한도](https://developers.cloudflare.com/durable-objects/platform/limits/)

## 배포와 검증

기존 integrations/cloudflare-mcp의 Wrangler 실행기를 이용해 `--config ../blog-counter/wrangler.jsonc`로 배포한다. `COUNTER` 바인딩과 v1 SQLite migration을 유지한다. Workers 쓰기와 계정 확인 권한만 필요하다. Worker URL 변경 시 assets/counter.js와 index.html의 connect-src를 함께 수정한다.

`node --test integrations/blog-counter/counter.test.mjs tests/blog-metadata.cjs`로 실제 Workers 로컬 실행기의 중복·동시 처리·게시물별 분리·입력 검증을 확인한다. 운영 서버에 인위적인 방문을 넣지 말고 GET 조회와 실제 브라우저 방문으로 배포를 확인한다.
