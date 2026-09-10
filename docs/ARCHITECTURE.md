# 아키텍처와 데이터 계약

## 책임 분리

| 경로 | 책임 | 현재 |
|---|---|---|
| src/game | 점수·분류·좌표·시계·설정, 이후 상태·입력·런 | 기준 계산만 구현 |
| src/scene | WebGL 2 렌더러, 카메라, 조명, 패드·장갑 경로 | 예정 |
| src/characters | 데이터, 전신 리그, 표정, 셔플백 | 예정 |
| src/endings | 호환 후보, 선택, 해금·감상 | 예정 |
| src/animation | 발사·공개·성공·실패 타임라인 | 예정 |
| src/ui / src/i18n | SVG HUD, 설정·결과·도감, 번역 | 예정 |
| src/audio | 첫 입력 이후 초기화, 음량·효과음 | 예정 |
| src/storage | 프로필 스키마·마이그레이션·오류 복구 | 예정 |
| public/assets | 확보한 로컬 게임 에셋 | 비어 있음 |
| tests / scripts | 계산 기준·재현·브라우저 smoke·문서 검사 | M0 하니스 |

순수 도메인 결과를 읽어 scene/UI/audio가 반응한다. 연출이 점수나 상대를 수정하지 않는다.
geometry의 Three.js 수학 클래스 사용은 렌더러 생성·DOM 접근을 요구하지 않는다.

## 상태 흐름

~~~text
BOOT → LOADING → MENU → PREPARE_ROUND → INTRO → POWER → AIM
→ FIRE → IMPACT_OR_MISS → REVEAL
REVEAL [success] → SUCCESS_SCENE → NEXT_ROUND → PREPARE_ROUND
REVEAL [failure] → FAILURE_SCENE → GAME_OVER
GAME_OVER → RETRY → PREPARE_ROUND
~~~

| 경계 | 조건 / 한 번 실행할 효과 |
|---|---|
| PREPARE_ROUND 진입 | 후보 peek, 해당 상대의 모든 유효 반응 에셋 준비 |
| 준비 성공 | 후보 commit으로 백 1회 소비, roundId 확정; 실패는 소비하지 않고 재시도 |
| POWER → AIM | 파워 스냅샷, 입력 해제 필요 플래그, 최대 점수 안내 |
| AIM → FIRE | 새 입력 확인, power/angle/origin/pad 복사·동결, 판정·유형·endingId 확정 |
| 공개 | 같은 전신 모델 회전, 캐릭터 발견 1회 기록 |
| 실패 본편 진입 | 플레이로 endingId에 도달했으므로 해금 1회 |
| 핵심 장면 / 정상 종료 | seen 기록; 최소화로 건너뛴 새 장면은 unlocked만 |
| 종료 / 스킵 | finish(roundId) 한 경로, 완료 토큰으로 1회 전이 |
| RETRY | 런과 임시 이펙트 초기화, 새 roundId, 프로필·백 유지 |

roundId는 런 번호와 별개의 세션 내 단조 ID다. 모든 지연 콜백은 현재 ID를 검사한다.
PREPARE의 비동기 응답에는 별도 preparation token을 붙여 오래된 로딩 완료를 무효화한다.
PAUSED는 상위 제어: 상태·시계·타임라인 위치를 보존하며 자동 복귀하지 않고 재개 버튼을 기다린다.
도감 PREVIEW는 런 밖의 별도 컨텍스트로 같은 연출 모듈만 재사용한다.
도감에서는 이미 해금한 장면의 seen 갱신만 허용하며 점수·백·게임오버는 발생시키지 않는다.

## 저장 데이터 v1 설계

| 데이터 | 필드 | RETRY |
|---|---|---|
| RunState | runId, roundNumber, totalScore, streak, currentRound | 초기화 |
| ProfileV1 | schemaVersion=1, bestScore, bestStreak, discoveredCharacterIds, unlockedEndingIds, seenEndingIds | 유지 |
| ProfileV1.bag | order, cursor, previousCharacterId, characterRngState | 유지 |
| ProfileV1.settings | locale, muted, reducedMotion, screenShake, minimizeScenes | 유지 |
| RoundContext | roundId, characterId, placement, gaugePeriods, phases, preparedAssets | 교체 |
| ShotResult | roundId, input, padSnapshot, intersection, score, failureType, endingId/null | 불변 |

seenEndingIds는 unlockedEndingIds의 부분집합이다. Set는 JSON 저장 시 배열로 직렬화한다.
저장 키 제안: poke-and-panic.profile.v1. 활성 런의 이어하기는 1차 범위에서 제외한다.
새로고침은 새 런으로 시작하되 저장된 백을 복원한다.
저장 읽기·쓰기 예외, 잘못된 JSON, 중복·미지 ID, 범위 밖 cursor, 미래 스키마를 검증한다.
손상 시 안전한 기본값·메모리 프로필로 진행하고, 지원하지 않는 미래 버전은 덮어쓰지 않는다.
매 프레임 저장하지 않고 공개·해금·감상·라운드 완료·설정 변경·백 commit 시 저장한다.
최고 점수는 성공 지급 또는 런 종료 시 동일한 멱등 갱신 함수를 사용한다.

## 셔플백·난수·재현

8개 고정 ID로 Fisher–Yates 백을 만든다. 새 백 첫 항목이 직전 상대면 다른 항목과 교환한다.
실패·재도전은 백 재생성을 유발하지 않는다. 로딩 재시도는 동일 예약 후보를 유지한다.
난수 스트림은 character, placement, gaugePhase, ending, visualEffects로 분리한다.
시드 PRNG 알고리즘과 버전은 M2에서 정하고 fixture에 기록한다. Math.random을 도메인에 직접 쓰지 않는다.

완전 재현 포맷 계획:
schemaVersion, rulesVersion, initialProfile, seed/각 스트림 상태, roundId,
placement/pad transform, phases/periods, 입력별 gameTimeMs, 선택 시점 seen/unlocked,
expected character/score/failure/ending/백 위치.
M0 fixture는 좌표와 확정 입력에 대한 판정 재현만 제공한다. 전체 런 재현은 M2다.

## 복구와 리소스 수명

WebGL 2 미지원·생성 실패는 SVG 설명과 재시도. context loss는 중지·자원 재구축 후 명시적 재개.
필수 에셋 실패는 실패 원인·재시도 경로를 제공한다. FIRE 이후 새 모델 다운로드를 시작하지 않는다.
렌더러는 앱 수명에 하나. 지오메트리·재질 공유 소유자를 정하고 dispose를 중복 호출하지 않는다.
타임라인·이벤트·오디오 노드는 라운드 종료/앱 종료의 책임을 구분한다.
저사양 모드는 DPR·이펙트만 줄이며 시계·배치·판정·다음 상대에 영향을 주지 않는다.
