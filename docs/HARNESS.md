# 개발·검증 하니스

## 구성과 실행

하니스 = 재현 가능한 설치·실행·빌드, 기준 로직 검사, 데이터·문서 무결성 검사, 브라우저 smoke, CI, 작업 기록 양식.
기준 함수는 이후 게임이 그대로 공유할 수 있도록 src/game에 두었다.
M0에서 전체 상태 머신·캐릭터·도감·저장·디버그 패널은 구현하지 않았다.

~~~sh
npm ci
npm run check
npm run harness:replay
npm run test:e2e:install
npm run test:e2e
~~~

check는 harness:check → typecheck → test → build 순서이며 실패하면 중단한다.
test:e2e는 기존 dist를 사용하는 preview 서버를 직접 시작·종료한다. 변경 후 먼저 build 또는 check를 실행한다.
이미 4173 포트가 사용 중이면 서버를 재사용하지 않고 실패한다. 다른 프로젝트를 검사하는 일을 방지한다.
단위 테스트는 tests/unit만, 브라우저 테스트는 tests/e2e만 수집한다.
test:watch는 로컬 반복 작업용이며 CI에서는 종료되는 test를 쓴다.

## 현재 기준 API

| 모듈 | 진입점 | 검증 범위 |
|---|---|---|
| game/scoring.ts | scoreContact, maxScore, centerSuccessBoundaryPercent, awardedScore | 공통 점수·경계·콤보 |
| game/failure.ts | classifyFailure | 실패의 최초 일치 우선순위 |
| game/geometry.ts | intersectPad | 실제 월드 패드 변환·수평 ray·로컬 접점 |
| game/clock.ts | GameClock, oscillate | 단조 시각·중지 제외·왕복 함수 |
| game/config.ts | RULES, TUNING | 고정 규칙과 초기 조정값 |

원본과 다른 숫자를 실험하려면 fixture만 바꾸지 말고 변경 결정·설정·UI 안내·테스트를 함께 검토한다.
점수·실패 판정은 캐릭터·도감 입력을 받지 않는다. 실제 선택 계층과 통합 후 공정성 회귀를 추가한다.

## fixture 추가

tests/fixtures/shots.json에 id, powerPercent, angleDegrees, padX, rawScore, failureType를 넣는다.
현재 공통 조건은 원점 [0,0,0], 패드 z=-3, 가로 반경 0.4, 세로 반경 0.3이다.
이 수치는 테스트 조건이며 제품 난이도 확정값이 아니다.
기대값은 명세·독립 계산으로 확인하고 tests/unit/replay.test.ts로 회귀한다.
입력 시간·초기 프로필·시드·endingId·셔플백까지 재현하는 fixture는 M2에서 확장한다.

## 프로젝트 검사

scripts/check-project.mjs는 필수 산출물, 요구사항 ID/원본 절/증거 파일,
8종의 각 실패 유형에 대한 후보, 5계열 호환성, 대표 장면 마커, 상대 참조, 로컬 문서 링크,
package와 lockfile의 루트 의존성 일치를 확인한다.
콘텐츠 계획의 status를 애니메이션 완성으로 올리는 기능은 없다.
반드시 실제 동작이 다른지는 CONTENT/QA의 영상 검수가 담당한다.

## CI와 기록

.github/workflows/ci.yml은 push/PR에서 Node 설치 → npm ci → check → Chromium 설치 → E2E를 실행한다.
실패 시 Playwright 보고서·trace를 artifact로 보관한다.
워크플로 파일은 준비했으며 원격 GitHub 실행은 별도 증거가 필요하다.
로컬 생성물 node_modules, dist, .cache, test-results, playwright-report는 Git에서 제외한다.
templates/TASK.md는 작업 계약, VERIFICATION.md는 검증 결과, PLAYTEST.md는 실제 관찰용이다.

## 환경 문제

Node 22.18.0, npm 10.9.3에서 준비했다. Windows의 제한된 실행 환경에서는
네트워크가 차단되거나 Vite/Vitest가 자식 프로세스 시작 시 spawn EPERM을 낼 수 있다.
이는 소스 테스트 실패와 구분한다. 허용된 네트워크·프로세스 실행 환경에서 같은 명령을 재실행하고 결과를 기록한다.
전역 프록시·보안 설정을 변경하지 않는다. 오프라인이면 사전 캐시 또는 네트워크 권한이 필요하다.
Playwright 브라우저는 최초 설치가 필요하다. 엔진 다운로드 실패를 테스트 통과로 처리하지 않는다.

## 패키지 선택 근거

2026-09-11 npm 공식 레지스트리에서 버전·엔진을 조회하고 로컬 빌드로 호환성을 확인했다.
Vite 8.3.0, Vitest 5.0.0, TypeScript 7.0.2, Playwright 1.63.0을 고정한다.
Three.js는 타입 패키지의 r185 계열에 맞춰 0.185.0과 @types/three 0.185.4를 선택했다.
현재 레지스트리 최신 Three.js 0.186.0과 타입 계열이 달라 자동 최신 조합을 피했다.
Node 22는 현재 작업 환경을 유지하기 위한 선택이며 업그레이드 시 lockfile과 전체 검증을 갱신한다.

- [Vite 설치·Node 요구사항](https://vite.dev/guide/)
- [Vitest 설치](https://vitest.dev/guide/)
- [Node.js 지원 릴리스](https://nodejs.org/en/about/previous-releases)
- [Playwright 설치·브라우저](https://playwright.dev/docs/intro)

## 구현 작업 운영

[브랜치 전략](BRANCHING.md), [플랫폼 경계](PLATFORMS.md), 루트 AGENTS의 스킬 목록을 사용한다.
작업 계약은 docs/tasks/<작업-id>.md, 검증 기록은 docs/verification/<날짜>-<작업-id>.md로 보관한다.
짧은 작업은 STATUS와 PR에 같은 필드를 기록해도 되며 빈 기록 파일을 미리 만들지 않는다.

`npm run branch:check`는 실제 구현 착수 시의 로컬 브랜치 또는 CI의 PR_HEAD_REF를 검사한다. M0 준비 중 main에서는 실행하지 않는다.
일반 check와 분리하여 main·태그·detached checkout의 빌드를 막지 않는다.
PR CI에서는 브랜치 검사도 필수다. 이름 검사는 원격 main 보호나 리뷰 승인을 대신하지 않는다.
스킬 파일과 PR 양식도 harness:check의 파일·링크 검사에 포함된다.

## 디자인 도구 하니스

[에셋·UI·UX 제작](DESIGN_WORKFLOW.md)에 도구 상태와 제작·검수 기준이 있다.
외부 스킬 고정 커밋·파일 해시는 external-skills.json에 기록하며 harness:check에서 검사한다.
개발 보조 스킬의 라이선스는 게임 에셋 라이선스와 별개다.
