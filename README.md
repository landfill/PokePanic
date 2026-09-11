# 똥침각 · Poke & Panic

두 번의 타이밍 입력과 실패 원인에 맞는 코미디 반전을 결합하는 모바일 웹 게임.
현재는 **M0: 문서 및 개발·검증 하니스** 단계다. 실제 플레이, 3D 캐릭터, 연출, 저장, 도감은 아직 구현하지 않았다.

## 시작

Node.js 22.18.0으로 로컬 검증한다. 지원 엔진은 22.18+의 22.x 또는 24.x이며, 의존성은 package-lock.json으로 고정한다.

~~~sh
npm ci
npm run dev
~~~

개발 주소는 http://127.0.0.1:5173 이다. 표시되는 준비 화면은 제품 UI가 아니다.
비밀키나 환경변수는 필요 없다.

## 검증 명령

~~~sh
npm run check
npm run harness:replay
npm run test:e2e:install
npm run build
npm run test:e2e
npm run preview
~~~

| 명령 | 용도 |
|---|---|
| dev / build / preview | 개발 서버 / 타입 검사와 정적 빌드 / 로컬 빌드 확인 |
| typecheck / test / test:watch | 타입 검사 / 기준 로직 자동 테스트 / 반복 실행 |
| harness:check | 필수 문서, 요구사항 연결, 콘텐츠 계획 무결성 |
| harness:replay | 고정 좌표·입력 fixture로 판정 재현 |
| check | 문서·데이터 검사 → 타입 검사 → 단위 테스트 → 빌드 |
| test:e2e | 사전 빌드를 사용한 Chromium 준비 화면·모듈·오류 smoke 검사 |

## 문서 읽는 순서

1. [문서 지도와 기준](docs/README.md)
2. [제품 요구사항](docs/PRODUCT.md)
3. [게임 규칙과 계약](docs/GAME_RULES.md)
4. [아키텍처·데이터](docs/ARCHITECTURE.md)
5. [캐릭터·결말·아트 제작](docs/CONTENT.md)
6. [단계별 구현 백로그](docs/IMPLEMENTATION.md)
7. [테스트·성능·플레이 테스트](docs/QA.md)
8. [하니스 사용법](docs/HARNESS.md)
9. [현재 검증 결과](docs/STATUS.md)

요구사항별 진행 상태는 [requirements.json](docs/requirements.json), 작업 규칙은 [AGENTS.md](AGENTS.md)에 있다.
원본 명세는 docs의 기존 마크다운을 그대로 보존했다.

## 배포 준비

Vercel: Framework Vite, Install npm ci, Build npm run build, Output dist.
현재는 단일 경로이며 SPA rewrite를 추가하지 않는다. preview는 배포 서버가 아니다.
배포 설정만 준비했으며 실제 배포·공개 URL 확인은 하지 않았다.

## 에셋과 제한

[ASSET_LICENSES.md](ASSET_LICENSES.md)에 에셋 확보·라이선스를 기록한다. 현재 외부 게임 에셋은 없다.
단위 테스트의 판정 검증, 브라우저 smoke, 게임 완성도, 실기기 성능, 재미 검증은 각각 구분한다.
지금 통과하는 smoke 테스트는 게임 시작→재도전의 통합 테스트가 아니다.

## 구현 작업 시작

현재 환경 준비는 main에서 진행한다. 실제 제품 구현 착수 시 [브랜치 전략](docs/BRANCHING.md)에 따라 분기하고 `npm run branch:check`를 실행한다.
[AGENTS.md](AGENTS.md)의 저장소 스킬과 [플랫폼 경계](docs/PLATFORMS.md)를 확인한다.
원격 main 보호 설정 여부와 최신 실행 결과는 STATUS에서 확인한다.
