import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindActionInput } from '../../src/input/action-input';

class FakeNode extends EventTarget {
  ownerDocument!: FakeDocument;
  parent: FakeNode | null = null;
  interactive = false;
  disabled = false;
  ariaDisabled: string | null = null;

  contains(node: Node | null): boolean {
    for (let current = node as unknown as FakeNode | null; current; current = current.parent) {
      if (current === this) return true;
    }
    return false;
  }

  closest(): FakeNode | null { return this.interactive ? this : null; }
  getAttribute(name: string): string | null { return name === 'aria-disabled' ? this.ariaDisabled : null; }
}

class FakeDocument extends EventTarget {
  defaultView = new EventTarget();
  visibilityState: DocumentVisibilityState = 'visible';
}

class InputEvent extends Event {
  constructor(type: string, init: Record<string, unknown>) {
    super(type, { cancelable: true });
    Object.assign(this, init);
  }
}

const originalElement = globalThis.Element;
const originalButton = globalThis.HTMLButtonElement;
afterEach(() => {
  globalThis.Element = originalElement;
  globalThis.HTMLButtonElement = originalButton;
});

function setup() {
  globalThis.Element = FakeNode as unknown as typeof Element;
  globalThis.HTMLButtonElement = FakeNode as unknown as typeof HTMLButtonElement;
  const document = new FakeDocument();
  const element = new FakeNode();
  element.ownerDocument = document;
  const presses: string[] = [];
  const releases: string[] = [];
  const onSuspend = vi.fn();
  const cleanup = bindActionInput({
    element: element as unknown as HTMLElement,
    onPress: token => presses.push(token),
    onRelease: token => releases.push(token),
    onSuspend,
  });
  return { document, element, window: document.defaultView, presses, releases, onSuspend, cleanup };
}

function pointer(type: string, pointerId: number, overrides: Record<string, unknown> = {}): Event {
  return new InputEvent(type, { pointerId, pointerType: 'touch', button: 0, isPrimary: true, ...overrides });
}

function key(type: string, code: string, target: FakeNode, overrides: Record<string, unknown> = {}): Event {
  const event = new InputEvent(type, {
    code, repeat: false, isComposing: false,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    ...overrides,
  });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

describe('R-INPUT: action input adapter', () => {
  it('uses pointerdown and requires a global release before another press', () => {
    const input = setup();
    input.element.dispatchEvent(pointer('pointerdown', 4));
    input.element.dispatchEvent(new Event('click'));
    input.element.dispatchEvent(pointer('pointerdown', 4));
    expect(input.presses).toEqual(['pointer:4']);

    input.window.dispatchEvent(pointer('pointerup', 4));
    input.element.dispatchEvent(pointer('pointerdown', 5));
    expect(input.presses).toEqual(['pointer:4', 'pointer:5']);
    expect(input.releases).toEqual(['pointer:4']);
  });

  it('tracks secondary touches so multitouch cannot bypass the release gate', () => {
    const input = setup();
    input.element.dispatchEvent(pointer('pointerdown', 1));
    input.element.dispatchEvent(pointer('pointerdown', 2, { isPrimary: false }));
    input.window.dispatchEvent(pointer('pointerup', 1));
    input.element.dispatchEvent(pointer('pointerdown', 3));
    expect(input.presses).toEqual(['pointer:1']);

    input.window.dispatchEvent(pointer('pointercancel', 2, { isPrimary: false }));
    input.window.dispatchEvent(pointer('pointerup', 3));
    input.element.dispatchEvent(pointer('pointerdown', 4));
    expect(input.presses).toEqual(['pointer:1', 'pointer:4']);
    expect(input.releases).toEqual(['pointer:1', 'pointer:2', 'pointer:3']);
  });

  it('accepts Space and Enter globally while filtering unsafe keyboard input', () => {
    const input = setup();
    const page = new FakeNode();
    const control = new FakeNode();
    control.interactive = true;
    const actionChild = new FakeNode();
    actionChild.parent = input.element;

    input.window.dispatchEvent(key('keydown', 'Space', control));
    const prevented = key('keydown', 'Space', page);
    prevented.preventDefault();
    input.window.dispatchEvent(prevented);
    input.window.dispatchEvent(key('keydown', 'Space', page, { repeat: true }));
    input.window.dispatchEvent(key('keydown', 'Space', page, { ctrlKey: true }));
    input.window.dispatchEvent(key('keydown', 'KeyA', page));
    input.window.dispatchEvent(key('keydown', 'Enter', actionChild));
    expect(input.presses).toEqual(['key:Enter']);

    input.window.dispatchEvent(key('keyup', 'Enter', page));
    input.window.dispatchEvent(key('keydown', 'Space', page));
    expect(input.presses).toEqual(['key:Enter', 'key:Space']);
  });

  it('does not accept pointer or keyboard actions while the action is disabled', () => {
    const input = setup();
    const page = new FakeNode();
    input.element.disabled = true;
    input.element.dispatchEvent(pointer('pointerdown', 1));
    input.window.dispatchEvent(key('keydown', 'Space', page));
    input.element.disabled = false;
    input.element.ariaDisabled = 'true';
    input.window.dispatchEvent(key('keydown', 'Enter', page));
    expect(input.presses).toEqual([]);
  });

  it('blocks overlapping pointer/key inputs until every physical input releases', () => {
    const input = setup();
    const page = new FakeNode();
    input.element.dispatchEvent(pointer('pointerdown', 1));
    input.window.dispatchEvent(key('keydown', 'Space', page));
    input.window.dispatchEvent(pointer('pointerup', 1));
    input.element.dispatchEvent(pointer('pointerdown', 2));
    expect(input.presses).toEqual(['pointer:1']);
    input.window.dispatchEvent(key('keyup', 'Space', page));
    input.window.dispatchEvent(pointer('pointerup', 2));
    input.window.dispatchEvent(key('keydown', 'Enter', page));
    expect(input.presses).toEqual(['pointer:1', 'key:Enter']);
  });

  it('suspends on blur or hidden and cleanup is idempotent', () => {
    const input = setup();
    input.element.dispatchEvent(pointer('pointerdown', 1));
    input.window.dispatchEvent(new Event('blur'));
    input.element.dispatchEvent(pointer('pointerdown', 2));
    expect(input.presses).toEqual(['pointer:1', 'pointer:2']);

    input.document.visibilityState = 'hidden';
    input.document.dispatchEvent(new Event('visibilitychange'));
    expect(input.onSuspend).toHaveBeenCalledTimes(2);

    input.element.dispatchEvent(pointer('pointerdown', 8));
    input.cleanup();
    input.cleanup();
    input.element.dispatchEvent(pointer('pointerdown', 3));
    expect(input.presses).toEqual(['pointer:1', 'pointer:2', 'pointer:8']);
    expect(input.releases).toEqual(['pointer:8']);
  });
});
