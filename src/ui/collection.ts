import { buildCollectionView, type CollectionData } from '../endings/collection';
import { message, type Locale } from '../i18n/messages';
import './collection.css';

export interface CollectionOpenData extends CollectionData {
  readonly locale: Locale;
}

export interface CollectionUICallbacks {
  readonly onReplay: (endingId: string, characterId: string) => void;
  readonly onClose: () => void;
}

export interface CollectionUI {
  open(data: CollectionOpenData): void;
  close(): void;
  dispose(): void;
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  if (className) result.className = className;
  return result;
}

export function createCollectionUI(host: HTMLElement, callbacks: CollectionUICallbacks): CollectionUI {
  const dialog = node('dialog', 'pp-collection');
  const shell = node('div', 'pp-collection-shell');
  const header = node('header', 'pp-collection-header');
  const title = node('h1', 'pp-collection-title');
  const closeButton = node('button', 'pp-collection-close');
  closeButton.type = 'button';
  header.append(title, closeButton);
  const content = node('div', 'pp-collection-content');
  const characterHeading = node('h2', 'pp-collection-heading');
  const characterList = node('ul', 'pp-character-list');
  const endingHeading = node('h2', 'pp-collection-heading');
  const endingList = node('ul', 'pp-ending-list');
  content.append(characterHeading, characterList, endingHeading, endingList);
  shell.append(header, content);
  dialog.append(shell);
  host.append(dialog);

  let focusReturn: HTMLElement | null = null;
  let disposed = false;

  const stopInput = (event: Event): void => { event.stopPropagation(); };
  dialog.addEventListener('pointerdown', stopInput);
  dialog.addEventListener('click', stopInput);
  dialog.addEventListener('keydown', stopInput);

  function close(): void {
    if (dialog.open) dialog.close();
    const target = focusReturn;
    focusReturn = null;
    target?.focus();
  }

  const closeFromControl = (): void => {
    close();
    callbacks.onClose();
  };
  closeButton.addEventListener('click', closeFromControl);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeFromControl();
  });

  function open(data: CollectionOpenData): void {
    if (disposed) return;
    const view = buildCollectionView(data);
    title.textContent = message(data.locale, 'collectionTitle');
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', message(data.locale, 'closeCollection'));
    characterHeading.textContent = message(data.locale, 'charactersLabel');
    endingHeading.textContent = message(data.locale, 'endingsLabel');
    characterList.replaceChildren();
    endingList.replaceChildren();

    for (const character of view.characters) {
      const item = node('li', `pp-character-card ${character.status === 'undiscovered' ? 'is-locked' : ''}`);
      item.textContent = character.status === 'discovered'
        ? character.name
        : message(data.locale, 'undiscoveredActor');
      characterList.append(item);
    }

    for (const ending of view.endings) {
      const item = node('li', `pp-ending-card ${ending.status === 'locked' ? 'is-locked' : ''}`);
      if (ending.status === 'locked') {
        item.textContent = message(data.locale, 'lockedEnding');
      } else {
        const row = node('div', 'pp-ending-row');
        const name = node('strong', 'pp-ending-name');
        name.textContent = ending.name;
        const badge = node('span', `pp-ending-badge ${ending.seen ? 'is-seen' : 'is-new'}`);
        badge.textContent = message(data.locale, ending.seen ? 'seenEnding' : 'newEnding');
        row.append(name, badge);
        item.append(row);
        const actions = node('div', 'pp-replay-actions');
        for (const character of ending.replayCharacters) {
          const replay = node('button', 'pp-replay-button');
          replay.type = 'button';
          replay.textContent = message(data.locale, 'replayEnding', { character: character.name });
          replay.addEventListener('pointerdown', stopInput);
          replay.addEventListener('keydown', stopInput);
          replay.addEventListener('click', event => {
            stopInput(event);
            callbacks.onReplay(ending.id, character.id);
          });
          actions.append(replay);
        }
        item.append(actions);
      }
      endingList.append(item);
    }

    if (!dialog.open) {
      focusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    }
    closeButton.focus();
  }

  return {
    open,
    close,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      close();
      closeButton.removeEventListener('click', closeFromControl);
      dialog.remove();
    },
  };
}
