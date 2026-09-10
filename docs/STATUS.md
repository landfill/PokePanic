# 현재 상태와 검증 결과

기준일: 2026-09-11 (Asia/Seoul). **M0 문서·개발·검증 하니스 구성을 완료했다.**
현재 게임 플레이·3D 캐릭터·연출·전체 상태·저장·도감은 미구현이다.
원본은 변경하지 않았다.

## 구성한 항목

제품·규칙·아키텍처·콘텐츠·백로그·QA·하니스·결정 문서와 기록 양식.
28개 추적 요구사항, 8종 캐릭터와 12개 결말 제작 후보, 40개 캐릭터/실패 유형 조합.
Vite/TypeScript/Three.js, lockfile, Vitest, Playwright, GitHub Actions.
점수·실패 분류·콤보·실제 월드 접점·공통 시계 기준 코드와 확정 입력 fixture.

## 실행 기록

Windows, Node 22.18.0, npm 10.9.3, 로컬 작업 트리(아직 커밋 없음).

| 실행 | 결과 | 범위·증거 |
|---|---|---|
| npm ci --offline=false --cache .cache/npm --fetch-retries=0 | 성공, lockfile로 50개 패키지 재설치 | 제한 환경의 네트워크·캐시 위치만 CLI 인자로 지정 |
| npm run check | 성공, 종료 코드 0 | 2026-09-11 02:31 KST 실행 |
| harness:check (check에 포함) | 28개 요구사항·8종·12개 후보·40개 조합 통과 | scripts/check-project.mjs; 계획 무결성 |
| typecheck (check에 포함) | 성공 | TypeScript 7.0.2 |
| test (check에 포함) | 4개 파일, **38개 테스트 통과** | tests/unit; 재현 fixture 10개 포함 |
| build (check에 포함) | 성공 | Vite 8.3.0, dist/index.html 및 JS 생성 |
| test:e2e:install | 성공 | Playwright 1.63.0, Chromium 153.0.8010.12 |
| npm run test:e2e | **2개 테스트 통과**, 종료 코드 0 | 데스크톱 Chromium·360×800 모바일 에뮬레이션 |
| npm run dev -- --port 5173 | 서버 시작 및 HTTP 200 확인 | /src/main.ts 진입점 포함 확인 후 서버 종료 |

브라우저 검증은 준비 화면과 570점 기준 결과가 실제 JS로 표시되고,
페이지·콘솔·요청 오류가 없으며 가로 넘침이 없는지를 확인했다.
preview 서버도 이 E2E 과정에서 시작·종료했다.
준비 화면 빌드는 HTML 0.54kB / JS 1.70kB였으며 실제 게임 에셋 용량·성능 증거로 사용하지 않는다.
로컬 Playwright 보고서는 playwright-report/index.html에 생성되며 Git에는 포함하지 않는다.

초기 일반 권한 실행은 환경의 네트워크 제한과 spawn EPERM으로 실패했다.
허용된 권한에서 동일 프로젝트의 설치·테스트·빌드를 재실행해 위 결과를 얻었다.
소스 테스트 실패로 남아 있는 항목은 없다. GitHub Actions 원격 실행은 하지 않았다.

## 다음 작업

M1-01 입력·상태 연결부터 진행한다. docs/IMPLEMENTATION.md의 수용 기준을 따른다.
실제 Android Chrome·Samsung Internet·iOS Safari, 게임 성능·접근성·재미·공개 배포는 미검증이다.
CI 파일은 구성했으며 원격 GitHub Actions 실행 여부와 구분한다.
