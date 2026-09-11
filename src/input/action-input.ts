export interface ActionInputOptions {
  element: HTMLElement;
  onPress: (token: string) => void;
  onRelease: (token: string) => void;
  onSuspend: () => void;
}

const ACTION_KEYS = new Set(['Space', 'Enter']);
const INTERACTIVE_SELECTOR =
  'button, input, select, textarea, a[href], [contenteditable]:not([contenteditable="false"]), [role="button"]';

function isInteractiveOutsideAction(target: EventTarget | null, action: HTMLElement): boolean {
  if (!(target instanceof Element) || action.contains(target)) return false;
  return target.closest(INTERACTIVE_SELECTOR) !== null;
}

function isActionDisabled(action: HTMLElement): boolean {
  return (action instanceof HTMLButtonElement && action.disabled) ||
    action.getAttribute('aria-disabled') === 'true';
}

export function bindActionInput({
  element,
  onPress,
  onRelease,
  onSuspend,
}: ActionInputOptions): () => void {
  const ownerDocument = element.ownerDocument;
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) throw new Error('Action element must belong to a window');

  const held = new Set<string>();
  let disposed = false;

  const hold = (token: string, eligible: boolean): void => {
    if (held.has(token)) return;
    const gateWasOpen = held.size === 0;
    held.add(token);
    if (eligible && gateWasOpen) onPress(token);
  };

  const release = (token: string): void => {
    if (!held.delete(token)) return;
    onRelease(token);
  };

  const onPointerDown = (event: PointerEvent): void => {
    const token = `pointer:${event.pointerId}`;
    if (isActionDisabled(element) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    hold(token, event.isPrimary && event.button === 0);
  };

  const onPointerRelease = (event: PointerEvent): void => {
    release(`pointer:${event.pointerId}`);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.defaultPrevented || isActionDisabled(element) ||
      !ACTION_KEYS.has(event.code) || event.repeat || event.isComposing ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      isInteractiveOutsideAction(event.target, element)
    ) return;
    hold(`key:${event.code}`, true);
    event.preventDefault();
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (!ACTION_KEYS.has(event.code)) return;
    release(`key:${event.code}`);
  };

  const suspend = (): void => {
    held.clear();
    onSuspend();
  };

  const onVisibilityChange = (): void => {
    if (ownerDocument.visibilityState === 'hidden') suspend();
  };

  element.addEventListener('pointerdown', onPointerDown);
  ownerWindow.addEventListener('pointerup', onPointerRelease, true);
  ownerWindow.addEventListener('pointercancel', onPointerRelease, true);
  ownerWindow.addEventListener('keydown', onKeyDown);
  ownerWindow.addEventListener('keyup', onKeyUp, true);
  ownerWindow.addEventListener('blur', suspend);
  ownerDocument.addEventListener('visibilitychange', onVisibilityChange);

  return (): void => {
    if (disposed) return;
    disposed = true;
    for (const token of [...held]) release(token);
    element.removeEventListener('pointerdown', onPointerDown);
    ownerWindow.removeEventListener('pointerup', onPointerRelease, true);
    ownerWindow.removeEventListener('pointercancel', onPointerRelease, true);
    ownerWindow.removeEventListener('keydown', onKeyDown);
    ownerWindow.removeEventListener('keyup', onKeyUp, true);
    ownerWindow.removeEventListener('blur', suspend);
    ownerDocument.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
