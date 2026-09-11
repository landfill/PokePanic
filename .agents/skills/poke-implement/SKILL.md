---
name: poke-implement
description: Poke & Panic의 M1~M4 게임 기능을 작은 동작 단위로 구현하거나 수정할 때 적용한다. 단순 현황 조회나 다른 저장소에는 적용하지 않는다.
---

# 게임 기능 구현

[AGENTS](../../../AGENTS.md)의 요청 범위와 우선순위를 따른다.
[STATUS](../../../docs/STATUS.md), [IMPLEMENTATION](../../../docs/IMPLEMENTATION.md)에서 해당 작업의 선행 조건을 확인한다.
환경·스킬 준비 요청에는 이 구현 절차를 시작하지 않는다.

- 요청한 동작에 대응하는 requirements.json의 ID·원본 절과 수용 기준을 확인한다.
  다음 작업을 요청받았다면 선행 조건이 충족된 가장 작은 미완료 단위를 선택한다.
  이번 요청이 특정 기능이면 백로그 전체를 자동 실행하지 않는다.
- 실제 제품 구현 요청이면 [브랜치 전략](../../../docs/BRANCHING.md)에 따라 사용자 변경을 보존하고 구현 브랜치를 준비한다.
- 목표 동작·수용 기준·변경 파일·관련 검증을 정한다. 복잡한 작업은 [작업 양식](../../../docs/templates/TASK.md)에 기록하고 짧은 작업은 STATUS에 남긴다.
- game 결과를 scene/UI/audio가 읽는 방향을 유지한다. 스냅샷 이후 모델 이동으로 판정을 바꾸지 않는다.
  타임라인과 비동기 응답은 현재 roundId/preparation token을 검사하고 종료 경로는 멱등으로 둔다.
- 요구사항에 맞는 관련 회귀를 먼저 선택한다. fixture 기대값을 현재 구현 출력만으로 산출하지 않는다.
- UI 변경이면 빌드한 제품 화면을 브라우저로 검증한다. 현재 readiness smoke만으로 게임 루프를 검증했다고 하지 않는다.
- 관련 검사 후 npm run check를 실행하고 [QA](../../../docs/QA.md)에 맞는 추가 증거를 확보한다.
  requirements와 STATUS에는 실행한 범위만 반영한다. 시각·실기기 검증이 남으면 verified로 올리지 않는다.

범위 밖 SDK·네이티브 프로젝트를 선행 구현하지 않는다. 플랫폼 경계가 바뀔 때만
[PLATFORMS](../../../docs/PLATFORMS.md)를 추가로 읽는다. 규칙 변경은 GAME_RULES와 ADR에 이유를 기록한다.
