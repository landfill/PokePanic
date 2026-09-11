import { GameSession } from '../../src/game/session';
import { bindActionInput } from '../../src/input/action-input';

let now = 0;
const session = new GameSession();
const output = document.querySelector<HTMLOutputElement>('#state')!;
function prepare() {
  session.prepareCurrentRound({ roundId: session.runView().currentRoundId, startWallTime: now,
    origin: [0,0,0], padSnapshot: {
      worldFromLocal: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-3,1], radiusX: 0.4, radiusY: 0.3,
    } });
}
function render() {
  const view = session.sample(now);
  output.textContent = JSON.stringify({ ...view.input, run: view.run });
}
prepare();
const dispose = bindActionInput({
  element: document.querySelector<HTMLButtonElement>('#action')!,
  onPress: token => { session.press(token, now); render(); },
  onRelease: token => session.release(token),
  onSuspend: () => { session.pause(now); render(); },
});
document.querySelector('#resume')!.addEventListener('click', () => { session.resume(now); render(); });
document.querySelector('#finish')!.addEventListener('click', () => { session.finishScene(session.runView().currentRoundId); render(); });
document.querySelector('#retry')!.addEventListener('click', () => { session.retry(); render(); });
document.querySelector('#prepare')!.addEventListener('click', () => { prepare(); render(); });
// Test-only entrypoint is built separately and never imported by src/main.ts.
declare global {
  interface Window { inputFixture: { at: (time: number) => void; dispose: () => void } }
}
window.inputFixture = { at: time => { now = time; render(); }, dispose };
render();
