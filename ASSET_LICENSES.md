# 에셋 출처와 사용 조건

외부 모델·텍스처·폰트·음원·영상은 제품에 반입하지 않았다. 아래 절차 생성 소스와 디자인 비교용 AI 이미지가 있다.
docs/content-plan.json의 assetKeys는 제작 계획 ID이며 실제 파일 경로가 아니다.
원본 마크다운은 사용자가 제공한 기획 자료이며 외부 배포 라이선스를 임의로 부여하지 않는다.
프로젝트 자체 소스의 공개 라이선스는 아직 지정하지 않았다. package는 private이다.

## 게임 에셋 등록 양식

| 로컬 파일 | 종류·용도 | 저작자·원본 URL | 라이선스·확인일 | 수정 내역 | 생성 소스·귀속 표시 |
|---|---|---|---|---|---|
| src/characters/rig.ts | 8 성인 전신 절차 메시·리그 (신규 6종 검수 중) | 이 프로젝트에서 Codex/Sol 생성, 외부 모델 없음 | 프로젝트 자체 공개 라이선스 미지정, 2026-09-11 | 얼굴·목·가방 끈·허리 연결을 실제 캡처로 보완 | 소스 자체가 생성 원본, 최종 품질 검수 진행 |
| src/scene/stage.ts | 폼 장갑·패드 좌표·스튜디오 | 이 프로젝트에서 생성, Three.js primitives/addon 사용 | 프로젝트 자체 공개 라이선스 미지정, 라이브러리 고지는 별도 | 불변 끝점과 실제 패드 matrix 연결 | 생성 소스 보존 |
| src/audio/sound.ts | 짧은 합성 효과음 | Web Audio oscillator/gain으로 직접 생성 | 프로젝트 자체 공개 라이선스 미지정 | 외부 음원 없음 | 생성 소스 보존 |
| docs/design/m1-directions/art-directions.png | 미채택 이미지 파일, 채택 방향 A의 비교 참고 | 내장 imagegen, 외부 참고 이미지 없음 | CC0 등 임의 부여 안 함, 2026-09-11 | 제품 코드 미사용 | docs/design/m1-directions/PROMPT.md |
| src/ui/game-ui.ts | SVG 게이지·HUD | 프로젝트에서 직접 작성 | 프로젝트 자체 공개 라이선스 미지정 | KO/EN은 실제 텍스트 | 생성·편집 소스 보존 |

직접 생성한 메시·SVG·음원은 생성 소스도 함께 기록한다.
외부 에셋은 실제 확보와 사용 조건 확인 뒤에만 runtime manifest에 등록한다.
존재하지 않는 GLB·임시 URL·개인 로컬 경로를 제품 코드에 넣지 않는다.

## 소프트웨어 의존성

정확한 버전·전이 의존성은 package-lock.json에 있다.
Three.js 및 개발 도구의 실제 라이선스는 각 설치 패키지의 LICENSE/라이선스 메타데이터를 따른다.
게임 에셋 권리와 npm 소프트웨어 라이선스를 혼동하지 않는다.
제품 배포 전 번들에 포함한 라이브러리의 고지 의무를 함께 확인한다.

## 외부 개발 스킬 고지

frontend-design은 Anthropic 공식 skills 저장소의 Apache-2.0 배포본이다.
원문 고지는 [.agents/skills/frontend-design/LICENSE.txt](.agents/skills/frontend-design/LICENSE.txt)에 보존한다.
고정 커밋·파일 해시는 [external-skills.json](docs/external-skills.json)에 있다.
개발 스킬을 설치한 것이 게임용 이미지·모델·폰트를 확보했다는 뜻은 아니다.

추가 생성 소스: src/scene/reactions.ts(성인 플레이어·경찰·소품 수갑·체인·먼지), src/scene/batching.ts(형태를 유지하는 정적 메시 병합). 외부 모델을 반입하지 않았다.
