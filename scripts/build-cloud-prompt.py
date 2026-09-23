"""Build a self-contained schedule prompt from the actual repository policies."""
from pathlib import Path
import hashlib
import subprocess

root = Path(__file__).resolve().parents[1]
files = ['AGENTS.md', 'docs/editorial-policy.md', 'docs/daily-run.md', 'docs/sources.md', 'templates/daily.md', 'templates/evidence.md']
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
header = '''매일 18:30 Asia/Seoul에 금융 뉴스를 조사·검증하고 Financial Summary Writer의 save_daily_summary로 Ji-Un-Gil/financialSummary에 저장한다. 사용자는 이 저장소에 보고서·검증표·목록을 자동 추가하는 것을 승인했다. 별도 유료 AI API나 로컬 컴퓨터에 의존하지 않는다.

실행 시작 시 아래에 포함된 저장소 지침·양식 원문을 전부 읽고 따른다. 이것은 원문을 읽지 못했을 때 임의로 요약한 규칙이 아니라, 운영자가 저장소에서 직접 읽어 이 예약에 넣은 명시적인 실행 지침이다. GitHub/Raw 웹 접근이 실패해도 이 내장 원문을 실제 읽을 수 있으므로 필수 지침을 못 읽었다는 이유만으로 실행을 중단하지 않는다. 뉴스 기사 원문 검증 의무는 변함없다. 웹에서 읽지 못한 뉴스를 내장 지침이나 검색 요약으로 대체하지 않는다.

가능하면 GitHub 또는 https://raw.githubusercontent.com/Ji-Un-Gil/financialSummary/master/ 의 최신 지침 및 briefings/README.md를 확인한다. 최신 지침을 읽었다면 우선 적용하고, 웹 계층에서 Cache miss/Failed to fetch가 나면 같은 URL을 반복하지 말고 내장 지침으로 진행하여 사용한 지침 버전을 검증표에 밝힌다. 최신 지침과 내장 지침의 충돌을 발견하면 발행 보류한다. 운영 지침 변경 시 예약의 내장 원문도 갱신해야 한다.

직전 성공 발행을 확인할 수 있으면 해당 마감 이후부터 당일 18:00까지 조사한다. 발행 목록 접근이 실패하면 이 대화의 실제 저장 성공 결과를 참고하되, 성공 여부를 알 수 없으면 전일 18:00 초과~당일 18:00로 범위를 명시하고 이전 누락 복구는 확인 불가라고 쓴다. 목록 접근 실패만으로 뉴스 수집을 포기하지 않는다. 과거 시각에 작성했다고 꾸미지 않는다. 같은 날짜 기존 내용은 저장 도구가 덮어쓰지 않으므로 충돌 시 중단하고 알린다.

한국 금융 뉴스를 우선 조사·배치한다. 검증 후보가 충분하면 국내 약 60~70%(3~5건 중 국내 2~3건 이상, 해외 1~2건 이하)를 목표로 하되 할당량을 억지로 채우지 않는다. 국내 부족 시 국내 최근 이슈 해설부터 검토하고 실제 국내/해외 건수를 명시한다. 아래 sources.md의 여섯 분야를 탐색하고 전일 보류 후보를 재검토한다. 신규 소식이 3건 미만이면 최근 7일의 검증된 이슈를 원 발표일을 명시한 별도 해설로 1~2건 보충한다. 과거 자료를 오늘 뉴스로 표시하지 않는다. 검증한 소식만 3~5건 이내로 작성하며 부족하면 줄인다. 각 뉴스에 용어 풀이를 넘어 변화의 의미·작동 원리·적용 조건을 2~3개의 짧은 문단으로 설명하고, 생활 관련성과 판단 한계를 근거에 따라 덧붙인다. 해설도 원문 또는 공신력 있는 교육 자료로 검증한다. 자체 표·도식과 출처 링크를 포함한다. 제목에는 구체적 주제를 쓴다. 자료 확보가 불충분하면 부분 수집으로 표시한다. 확인 가능 항목이 없으면 기사 수치를 만들지 말고 수집 상태·실제 시도·한계를 보고서와 검증표로 남긴다. 실제 도구 시각을 얻을 수 없으면 확인 시각을 미상으로 기록한다.

아래 양식의 report/evidence를 작성하고 검토한 뒤 save_daily_summary(date=한국시간 발행일, report=전체 Markdown, evidence=전체 Markdown)를 실제 호출한다. 클라우드 실행에서는 daily-run의 로컬 git 커밋·push 단계만 이 도구로 대신한다. 각 문서는 100자 이상 150KB 이하, report에 날짜·수집 상태·수집 한계·정정 기록, evidence에 날짜·출처·주장 대조·발행 전 검토 결과를 포함한다. 실제 saved=true, commit SHA, urls 반환을 확인한 때만 저장 완료라고 보고한다. 도구 없음·인증·승인·저장 실패는 작성 결과를 대화에 보존하고 실패 단계와 오류를 알린다. 신규 저장 성공 시 블로그 https://ji-un-gil.github.io/financialSummary/ 링크도 함께 안내한다. 변화 없는 재실행은 조용히 종료한다.

'''
parts = [header, f'내장 원문 기준 Git 커밋: {sha}\n']
for name in files:
    text = (root/name).read_text()
    digest = hashlib.sha256(text.encode()).hexdigest()
    parts.append(f'\n===== {name} (SHA256 {digest}) =====\n{text}')
parts.append('\n\n추가 검증 규칙: 공표 예정표·주간보도계획은 실제 공개 시각의 증거가 아니다. 마감 전 공개는 시각이 있는 실제 원문·기사 등으로 별도 확인하고 근거를 남긴다. 기관 홈페이지 목록의 발췌 대신 영구 상세 페이지 본문을 우선 열어 대조한다. 검증 기록 링크는 보고서 기준 ../../../evidence/YYYY/MM/YYYY-MM-DD.md의 Markdown 링크로 쓴다.\n')
output = root/'docs/cloud-schedule-prompt.txt'
output.write_text(''.join(parts))
print(f'{output}: {len(output.read_text())} characters')
