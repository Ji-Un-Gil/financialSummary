# 금융 노트 블로그 운영

- 공개 주소: https://ji-un-gil.github.io/financialSummary/
- 호스팅: 공개 저장소의 GitHub Pages, 무료 github.io 주소 사용.
- 배포 원본: master 브랜치, /(root), Deploy from a branch. `.nojekyll`로 정적 파일을 그대로 제공한다.
- 화면: `index.html`, `assets/style.css`, `assets/app.js`. 빌드·유료 API·서버 비밀값이 필요 없다.

## 매일 자동 반영

클라우드 뉴스 예약이 보고서·검증표·`briefings/README.md` 목록을 저장하면 다음 사이트 방문/새로고침 때 공개 GitHub raw 파일을 읽는다. GitHub CDN 반영에는 지연이 있을 수 있다. 사이트 자체 코드 변경은 GitHub Pages 배포 완료 후 반영된다. 브라우저 한 번 방문 동안은 읽은 문서를 메모리에 캐시한다.

목록 형식: `| YYYY-MM-DD | [제목](YYYY/MM/YYYY-MM-DD.md) | 수집 상태 |`. 기존 클라우드 Writer가 추가하는 행도 지원한다. 날짜와 경로가 일치하는 행만 읽으며 임의 경로를 받아들이지 않는다. 최신 글은 날짜순으로 선택하며 실제 작성 시각과 수집 한계를 원문 그대로 표시한다. 뉴스 저장을 사이트가 대신 실행하지는 않는다.

개별 주소 예: `/#/post/2026-09-17`, 검증표 `/#/evidence/2026-09-17`. 실제 프로젝트 주소 뒤에 붙인다. 제목·날짜 검색과 월 필터, 9개 단위 목록, 이전/다음 글, 목차, 링크 복사와 인쇄 기능을 제공한다. 검색은 목록 제목·날짜 기준이며 본문 전체 검색이 아니다.

원문을 재작성하지 않고 Markdown을 화면에 변환한다. 문장별 출처와 수집 상태·한계·정정 기록을 보존한다. Markdown HTML은 DOMPurify로 정화한다. 현재 표는 반응형 가로 스크롤을 제공하고 코드 블록은 원문 그대로 표시한다. Mermaid 코드를 별도 그래프로 렌더링하지는 않는다. 외부 이미지는 자동 삽입하지 않고 대체 문구와 원문 링크로 확인하도록 한다.

## 검증 및 장애 대응

로컬: 저장소 루트에서 `python3 -m http.server 8765 --bind 127.0.0.1`, 브라우저로 `http://127.0.0.1:8765/` 접속. JavaScript가 필요하다. 원격 데이터 열람 실패 시 오류·재시도·GitHub 원문 이동을 표시하며 성공한 것처럼 빈 목록을 표시하지 않는다.

공개 저장소의 최신 원문은 인증 없이 읽는다. GitHub raw 또는 Pages 장애 시 웹 읽기가 실패할 수 있다. 자바스크립트 해시 경로를 사용하는 사이트라 검색 엔진의 개별 글 색인·SNS별 미리보기는 제한적이다. 서버 렌더링과 RSS는 아직 제공하지 않는다.

관련 공식 문서: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
