# 브라우저 라이브러리

외부 CDN 스크립트를 실행하지 않도록 배포 파일을 저장소에 포함한다.

- Marked 15.0.12: https://www.npmjs.com/package/marked/v/15.0.12 — `marked-LICENSE.md` (MIT)
- DOMPurify 3.4.15: https://www.npmjs.com/package/dompurify/v/3.4.15 — `dompurify-LICENSE` (Apache-2.0 또는 MPL-2.0)

Markdown 변환 후 DOMPurify를 적용한다. 인라인 스타일·폼·프레임을 허용하지 않는다. 라이브러리 갱신 시 실제 브라우저에서 표, 링크, 악성 HTML 제거를 검토한다.
