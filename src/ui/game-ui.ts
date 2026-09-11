import { centerSuccessBoundaryPercent } from '../game/scoring';
import type { FailureType } from '../game/failure';
import { failureMessage, message, type Locale } from '../i18n/messages';
import './game.css';

export type UIPhase = 'MENU' | 'POWER' | 'AIM' | 'SCENE' | 'GAME_OVER' | 'PAUSED' | 'ERROR';

export interface UIView {
  readonly phase: UIPhase;
  readonly locale: Locale;
  readonly powerPercent: number;
  readonly angleDegrees: number;
  readonly maxRawScore: number;
  readonly canStillSucceed: boolean;
  readonly roundNumber: number;
  readonly totalScore: number;
  readonly bestScore: number;
  readonly muted: boolean;
  readonly rawScore?: number;
  readonly failureType?: FailureType | null;
  readonly canSkip?: boolean;
  /** The scene controller enables this only after the impact/reveal threshold. */
  readonly showScore?: boolean;
  readonly error?: string;
}

export interface GameUICallbacks {
  readonly onStart: () => void;
  readonly onRetry: () => void;
  readonly onResume: () => void;
  readonly onSkip: () => void;
  readonly onLocale: (locale: Locale) => void;
  readonly onMute: (muted: boolean) => void;
  readonly onSettings: () => void;
  readonly onCollection?: () => void;
}

export interface GameUI {
  readonly action: HTMLButtonElement;
  render(view: UIView): void;
  dispose(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function stopGameInput(event: Event): void {
  event.stopPropagation();
}

export function createGameUI(container: HTMLElement, callbacks: GameUICallbacks): GameUI {
  const root = element('div', 'pp-ui');
  const top = element('header', 'pp-topbar');
  const stats = element('dl', 'pp-stats');
  const roundLabel = element('div', 'pp-stat');
  const totalLabel = element('div', 'pp-stat');
  const bestLabel = element('div', 'pp-stat');
  stats.append(roundLabel, totalLabel, bestLabel);

  const tools = element('nav', 'pp-tools');
  const localeButton = element('button', 'pp-tool');
  const muteButton = element('button', 'pp-tool');
  const settingsButton = element('button', 'pp-tool');
  const collectionButton = callbacks.onCollection ? element('button', 'pp-tool') : null;
  for (const button of [localeButton, muteButton, settingsButton, collectionButton]) {
    if (!button) continue;
    button.type = 'button';
    button.addEventListener('pointerdown', stopGameInput);
    button.addEventListener('click', stopGameInput);
    button.addEventListener('keydown', stopGameInput);
    tools.append(button);
  }
  top.append(stats, tools);

  const panel = element('section', 'pp-panel');
  const title = element('h1', 'pp-title');
  const helper = element('p', 'pp-helper');
  const powerReadout = element('div', 'pp-power-readout');
  const powerValue = element('strong', 'pp-power-value');
  const successLabel = element('span', 'pp-success-label');
  powerReadout.append(powerValue, successLabel);
  const meter = element('div', 'pp-power-meter');
  const successZone = element('span', 'pp-power-success');
  const powerMarker = element('span', 'pp-power-marker');
  const zeroTick = element('span', 'pp-power-end pp-power-end-start');
  const hundredTick = element('span', 'pp-power-end pp-power-end-finish');
  zeroTick.textContent = '0';
  hundredTick.textContent = '100';
  meter.append(successZone, powerMarker, zeroTick, hundredTick);

  const fan = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  fan.classList.add('pp-fan');
  fan.setAttribute('viewBox', '0 0 300 112');
  fan.innerHTML = '<path class="pp-fan-arc" d="M34 80 A126 126 0 0 1 266 80 L150 108Z"/><path class="pp-fan-tick" d="M34 80l10 5M70 39l8 9M150 8v14M230 39l-8 9M266 80l-10 5"/><path class="pp-needle" d="M150 108V16"/><circle class="pp-pivot" cx="150" cy="108" r="7"/><text x="17" y="108">−60°</text><text x="251" y="108">+60°</text>';
  const needle = fan.querySelector<SVGPathElement>('.pp-needle')!;

  const result = element('div', 'pp-result');
  const score = element('strong', 'pp-score');
  const reason = element('p', 'pp-reason');
  result.append(score, reason);

  const errorText = element('p', 'pp-error');
  const action = element('button', 'pp-action');
  action.type = 'button';
  action.dataset.gameAction = 'true';
  const skipButton = element('button', 'pp-skip');
  skipButton.type = 'button';
  skipButton.addEventListener('pointerdown', stopGameInput);
  skipButton.addEventListener('keydown', stopGameInput);
  skipButton.addEventListener('click', event => {
    stopGameInput(event);
    callbacks.onSkip();
  });

  const safety = element('p', 'pp-safety');
  const live = element('p', 'pp-visually-hidden');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  panel.append(title, helper, powerReadout, meter, fan, result, errorText, action, skipButton, safety);
  root.append(top, panel, live);
  container.append(root);

  let current: UIView | null = null;
  let announcementKey = '';
  let staticSignature = '';
  let disposed = false;

  const onLocale = (event: Event): void => {
    stopGameInput(event);
    if (current) callbacks.onLocale(current.locale === 'ko' ? 'en' : 'ko');
  };
  const onMute = (event: Event): void => {
    stopGameInput(event);
    if (current) callbacks.onMute(!current.muted);
  };
  const onSettings = (event: Event): void => { stopGameInput(event); callbacks.onSettings(); };
  const onCollection = (event: Event): void => { stopGameInput(event); callbacks.onCollection?.(); };
  localeButton.addEventListener('click', onLocale);
  muteButton.addEventListener('click', onMute);
  settingsButton.addEventListener('click', onSettings);
  collectionButton?.addEventListener('click', onCollection);

  const onAction = (): void => {
    if (!current) return;
    if (current.phase === 'MENU') callbacks.onStart();
    else if (current.phase === 'GAME_OVER') callbacks.onRetry();
    else if (current.phase === 'PAUSED' || current.phase === 'ERROR') callbacks.onResume();
  };
  action.addEventListener('click', onAction);

  function render(view: UIView): void {
    if (disposed) return;
    current = view;
    const roundedPower = Math.round(view.powerPercent);
    meter.setAttribute('aria-valuenow', String(roundedPower));
    meter.setAttribute('aria-label', message(view.locale, 'power', { power: roundedPower }));
    powerValue.textContent = message(view.locale, 'powerValue', { power: roundedPower });
    const boundary = centerSuccessBoundaryPercent();
    successZone.style.left = `${boundary}%`;
    successZone.style.width = `${100 - boundary}%`;
    powerMarker.style.left = `${Math.max(0, Math.min(100, view.powerPercent))}%`;
    const angle = Math.max(-60, Math.min(60, view.angleDegrees));
    needle.style.transform = `rotate(${angle}deg)`;
    fan.setAttribute('aria-label', message(view.locale, 'angle', { angle: Math.round(angle) }));

    const nextStaticSignature = [
      view.locale, view.phase, view.maxRawScore, view.canStillSucceed, view.roundNumber,
      view.totalScore, view.bestScore, view.muted, view.rawScore, view.failureType,
      view.canSkip, view.error, view.showScore,
    ].join('|');
    if (nextStaticSignature === staticSignature) return;
    staticSignature = nextStaticSignature;

    root.dataset.phase = view.phase;
    root.lang = view.locale;
    roundLabel.innerHTML = `<dt>${message(view.locale, 'round')}</dt><dd>${view.roundNumber}</dd>`;
    totalLabel.innerHTML = `<dt>${message(view.locale, 'total')}</dt><dd>${view.totalScore}</dd>`;
    bestLabel.innerHTML = `<dt>${message(view.locale, 'best')}</dt><dd>${view.bestScore}</dd>`;
    localeButton.textContent = view.locale === 'ko' ? 'EN' : 'KO';
    localeButton.setAttribute('aria-label', message(view.locale, 'locale'));
    muteButton.textContent = view.muted ? '◌' : '♪';
    muteButton.setAttribute('aria-label', message(view.locale, view.muted ? 'unmute' : 'mute'));
    muteButton.setAttribute('aria-pressed', String(view.muted));
    settingsButton.textContent = '⚙';
    settingsButton.setAttribute('aria-label', message(view.locale, 'settings'));
    if (collectionButton) {
      collectionButton.textContent = '▦';
      collectionButton.setAttribute('aria-label', message(view.locale, 'collection'));
    }
    meter.setAttribute('role', 'meter');
    meter.setAttribute('aria-valuemin', '0');
    meter.setAttribute('aria-valuemax', '100');
    successLabel.textContent = message(view.locale, 'possibleAtCenter');

    powerReadout.hidden = view.phase !== 'POWER';
    meter.hidden = view.phase !== 'POWER';
    fan.toggleAttribute('hidden', view.phase !== 'AIM');
    const resultVisible = view.phase === 'GAME_OVER' || (view.phase === 'SCENE' && view.showScore === true);
    result.hidden = !resultVisible;
    errorText.hidden = view.phase !== 'ERROR';
    safety.hidden = view.phase !== 'MENU';
    skipButton.hidden = view.phase !== 'SCENE' || view.canSkip !== true;
    skipButton.textContent = message(view.locale, 'skip');
    action.hidden = view.phase === 'SCENE';

    let announce = '';
    if (view.phase === 'MENU') {
      title.textContent = message(view.locale, 'brand');
      helper.textContent = message(view.locale, 'strapline');
      action.textContent = message(view.locale, 'start');
      safety.textContent = message(view.locale, 'safety');
    } else if (view.phase === 'POWER') {
      title.textContent = message(view.locale, 'powerTitle');
      helper.textContent = message(view.locale, 'powerHelp');
      action.textContent = message(view.locale, 'powerAction');
      announce = message(view.locale, 'livePower');
    } else if (view.phase === 'AIM') {
      title.textContent = message(view.locale, 'aimTitle');
      helper.textContent = `${message(view.locale, 'maxScore', { score: view.maxRawScore })} · ${message(view.locale, 'target')} · ${view.canStillSucceed ? message(view.locale, 'aimHelp') : message(view.locale, 'lowPower')}`;
      action.textContent = message(view.locale, 'aimAction');
      announce = message(view.locale, 'liveAim');
    } else if (view.phase === 'SCENE') {
      title.textContent = message(view.locale, 'sceneTitle');
      helper.textContent = message(view.locale, 'sceneHelp');
      if (view.showScore === true) {
        const rawScore = view.rawScore ?? 0;
        const failure = failureMessage(view.locale, view.failureType);
        score.textContent = message(view.locale, 'score', { score: rawScore });
        reason.textContent = failure;
        announce = message(view.locale, 'liveResult', { score: rawScore, reason: failure });
      } else {
        announce = message(view.locale, 'liveScene');
      }
    } else if (view.phase === 'GAME_OVER') {
      const rawScore = view.rawScore ?? 0;
      const failure = failureMessage(view.locale, view.failureType);
      title.textContent = message(view.locale, 'gameOver');
      helper.textContent = message(view.locale, 'target');
      score.textContent = message(view.locale, 'score', { score: rawScore });
      reason.textContent = failure;
      action.textContent = message(view.locale, 'retry');
      announce = message(view.locale, 'liveGameOver', { score: rawScore, reason: failure });
    } else if (view.phase === 'PAUSED') {
      title.textContent = message(view.locale, 'paused');
      helper.textContent = message(view.locale, 'pausedHelp');
      action.textContent = message(view.locale, 'resume');
      announce = message(view.locale, 'livePaused');
    } else {
      title.textContent = message(view.locale, 'error');
      helper.textContent = message(view.locale, 'errorHelp');
      errorText.textContent = view.error ?? '';
      action.textContent = message(view.locale, 'retryLoad');
      announce = message(view.locale, 'liveError', { error: view.error ?? message(view.locale, 'error') });
    }

    const resultKey = resultVisible ? `${view.rawScore}:${view.failureType}` : '';
    const nextAnnouncementKey = `${view.locale}:${view.phase}:${resultKey}:${view.phase === 'ERROR' ? view.error : ''}`;
    if (announce && nextAnnouncementKey !== announcementKey) live.textContent = announce;
    announcementKey = nextAnnouncementKey;
  }

  return {
    action,
    render,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      action.removeEventListener('click', onAction);
      localeButton.removeEventListener('click', onLocale);
      muteButton.removeEventListener('click', onMute);
      settingsButton.removeEventListener('click', onSettings);
      collectionButton?.removeEventListener('click', onCollection);
      root.remove();
    },
  };
}
