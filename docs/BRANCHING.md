# 브랜치와 통합 전략

## 기본 흐름

`main`은 검증을 통과한 통합 기준이다. 현재 M0의 main을 출시 가능한 게임이라고 부르지 않는다.
현재 M0 환경·문서·스킬 준비는 main에서 진행하며 브랜치를 생성하지 않는다.
실제 제품 구현을 시작할 때부터 아래 전략을 적용한다. 상시 develop 브랜치는 두지 않는다.
한 구현 브랜치에는 하나의 동작 단위를 담는다. 구현 이후 유지보수 브랜치는 해당 작업 착수 시 만든다.

- 이름: `codex/<type>/<slug>`; type은 feat, fix, refactor, test, docs, chore, perf, hotfix.
- slug는 소문자 영숫자와 하이픈. 예: `codex/feat/m1-01-input-state`.
- 구현은 main에서 작업 브랜치를 만든 뒤 진행한다. 현재 작업에 맞는 기존 브랜치는 재사용한다.
- 시작 전 `git status --short`, `git branch --show-current`로 사용자 변경과 브랜치를 확인한다.
- 원격이 있으면 fetch 후 최신 origin/main에서 분기한다. 오프라인이면 확인 가능한 로컬 main을 사용하고 기준 커밋과 제약을 기록한다.
- 기존 미커밋 변경을 자동으로 reset, clean, stash하지 않는다. 서로 다른 작업이 겹치면 보존하고 충돌 범위만 해결한다.

~~~sh
git switch main
git switch -c codex/feat/m1-01-input-state
npm run branch:check
~~~

위 명령은 작업 트리가 안전할 때만 사용한다. 진행 중 브랜치를 기계적으로 main으로 바꾸지 않는다.
다른 사람과 공유한 브랜치는 main을 merge해 갱신한다. 개인 브랜치의 rebase도 기존 작업 보존이 확인될 때만 한다.
일반 작업에서 force push를 사용하지 않는다. 한 작업의 PR은 main을 대상으로 하며 squash merge를 기본으로 한다.
커밋/PR 제목은 `feat: ...`, `fix: ...`, `chore: ...`처럼 실제 변경을 설명한다.
커밋·원격 push·PR·merge는 해당 요청 범위에 따라 수행한다. 이 문서 자체가 공개·배포 권한을 부여하지 않는다.

## PR 게이트

PR 양식에 작업 ID, 요구사항, 변경 동작, 검증 결과와 미실행 항목을 기록한다.
프로젝트 하니스의 validate 작업에서 branch:check(PR만), npm ci, check, Chromium E2E가 성공해야 한다.
UI 변경은 관련 제품 E2E 및 화면 검증, 판정 변경은 경계·재현 회귀가 필요하다.
main에 넣었다는 이유로 requirements 상태를 verified로 올리지 않는다.

구현 단계부터 적용할 원격 관리자 설정 목표: main의 직접 push·삭제·force push 차단, PR 필수, validate 필수,
미해결 리뷰 대화 해소. 협업 리뷰어가 있으면 승인 1명도 필수로 설정한다.
로컬 파일은 이 보호를 강제하지 못한다. 실제 설정 여부는 STATUS에 별도로 적는다.

## 릴리스와 긴급 수정

웹과 앱은 같은 main의 코어를 공유한다. 장기 web/android/ios 브랜치를 만들지 않는다.
출시 게이트를 통과한 승인 커밋에 `web-vX.Y.Z` 또는 `app-vX.Y.Z` 태그로 구분한다.
태그 생성·스토어 제출·배포는 실제 릴리스 요청에서 실행한다. 패키징 빌드 번호는 앱 단계에서 관리한다.
긴급 수정은 main이 해당 릴리스와 호환되면 main에서 hotfix 브랜치를 만든다.
호환되지 않으면 출시 태그에서 분기하여 수정·검증 후 동일 수정을 main에도 반영하고 새 패치 태그를 만든다.
출시 태그를 이동하지 않는다. 웹 롤백은 검증된 이전 산출물로, 앱은 수정 버전 제출 절차로 대응한다.
