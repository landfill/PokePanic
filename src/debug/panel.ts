import type { RuntimeCharacterId } from '../endings/runtime';
import { assertSessionReplay, runSessionReplay, type SessionReplayFixture } from '../game/replay';

export interface DebugPanelOptions {
  readonly getFixture: () => SessionReplayFixture | null;
  readonly getDiagnostics: () => unknown;
  readonly onPreview: (characterId: RuntimeCharacterId, endingId: string) => void;
  readonly characters: readonly RuntimeCharacterId[];
  readonly endings: readonly Readonly<{ id: string; characterIds: readonly RuntimeCharacterId[] }>[];
}

function button(label: string): HTMLButtonElement {
  const result = document.createElement('button');
  result.type = 'button';
  result.textContent = label;
  return result;
}

/** Event-driven development panel. Call only from an import.meta.env.DEV branch. */
export function createDebugPanel(host: HTMLElement, options: DebugPanelOptions): () => void {
  const panel = document.createElement('details');
  panel.className = 'debug-panel';
  const summary = document.createElement('summary');
  summary.textContent = '개발 도구';
  panel.append(summary);
  const style=document.createElement('style');
  style.textContent=`.debug-panel{position:absolute;z-index:60;top:76px;right:8px;max-width:calc(100% - 16px);max-height:calc(100dvh - 90px);overflow:auto;padding:8px;border:1px solid #24334b;border-radius:8px;background:#fffaf0;color:#24334b;font:13px system-ui}.debug-panel[open]{width:440px}.debug-panel summary{cursor:pointer;min-height:28px}.debug-panel fieldset{margin:8px 0;min-width:0}.debug-panel textarea{box-sizing:border-box;width:100%;font:12px monospace}.debug-panel pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto}.debug-panel button{margin:3px;min-height:32px}`;
  panel.append(style);

  const replayGroup = document.createElement('fieldset');
  const replayLegend = document.createElement('legend');
  replayLegend.textContent = '판정 재현 JSON';
  const textarea = document.createElement('textarea');
  textarea.rows = 12;
  textarea.cols = 54;
  textarea.spellcheck = false;
  textarea.setAttribute('aria-label', '판정 재현 JSON');
  const load = button('현재 기록 불러오기');
  const replay = button('격리 재현 실행');
  const copy = button('JSON 복사');
  const download = button('JSON 다운로드');
  const replayOutput = document.createElement('pre');
  replayOutput.setAttribute('role', 'status');
  replayGroup.append(replayLegend, textarea, load, replay, copy, download, replayOutput);

  const previewGroup = document.createElement('fieldset');
  const previewLegend = document.createElement('legend');
  previewLegend.textContent = '강제 연출 미리보기';
  previewGroup.append(previewLegend);
  for (const characterId of options.characters) {
    for (const ending of options.endings) {
      if (!ending.characterIds.includes(characterId)) continue;
      const preview = button(`${characterId} · ${ending.id}`);
      preview.addEventListener('click', () => options.onPreview(characterId, ending.id));
      previewGroup.append(preview);
    }
  }

  const diagnosticsGroup = document.createElement('fieldset');
  const diagnosticsLegend = document.createElement('legend');
  diagnosticsLegend.textContent = '진단 정보';
  const refreshDiagnostics = button('진단 새로고침');
  const diagnosticsOutput = document.createElement('pre');
  diagnosticsOutput.setAttribute('role', 'status');
  diagnosticsGroup.append(diagnosticsLegend, refreshDiagnostics, diagnosticsOutput);
  panel.append(replayGroup, previewGroup, diagnosticsGroup);
  host.append(panel);

  const stopInput = (event: Event): void => event.stopPropagation();
  panel.addEventListener('pointerdown', stopInput);
  panel.addEventListener('click', stopInput);
  panel.addEventListener('keydown', stopInput);

  const writeError = (error: unknown): void => {
    replayOutput.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  };
  const parseFixture = (): SessionReplayFixture => JSON.parse(textarea.value) as SessionReplayFixture;
  load.addEventListener('click', () => {
    const fixture = options.getFixture();
    if (fixture === null) {
      replayOutput.textContent = '완료된 라운드가 없습니다.';
      return;
    }
    textarea.value = JSON.stringify(fixture, null, 2);
    replayOutput.textContent = '현재 기록을 불러왔습니다.';
  });
  replay.addEventListener('click', () => {
    let actual: ReturnType<typeof runSessionReplay> | null = null;
    try {
      const fixture = parseFixture();
      actual = runSessionReplay(fixture);
      assertSessionReplay(fixture);
      replayOutput.textContent = `격리 재현 성공\n${JSON.stringify(actual, null, 2)}`;
    } catch (error) {
      writeError(error);
      if (actual !== null) replayOutput.textContent += `\n\n실제 결과\n${JSON.stringify(actual, null, 2)}`;
    }
  });
  copy.addEventListener('click', () => {
    try {
      void navigator.clipboard.writeText(textarea.value)
        .then(() => { replayOutput.textContent = 'JSON을 복사했습니다.'; })
        .catch(writeError);
    } catch (error) {
      writeError(error);
    }
  });
  download.addEventListener('click', () => {
    try {
      const fixture = parseFixture();
      const url = URL.createObjectURL(new Blob([JSON.stringify(fixture, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'poke-and-panic-session-replay.json';
      anchor.click();
      URL.revokeObjectURL(url);
      replayOutput.textContent = 'JSON 다운로드를 시작했습니다.';
    } catch (error) {
      writeError(error);
    }
  });
  refreshDiagnostics.addEventListener('click', () => {
    try {
      diagnosticsOutput.textContent = JSON.stringify(options.getDiagnostics(), null, 2);
    } catch (error) {
      diagnosticsOutput.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
  });

  return (): void => panel.remove();
}
