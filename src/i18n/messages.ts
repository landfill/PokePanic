import type { FailureType } from '../game/failure';

export type Locale = 'ko' | 'en';

const messages = {
  ko: {
    brand: '똥침각',
    strapline: '각은 봤고, 앞은 못 봤다.',
    safety: '20세 이상 성인 배우들의 만화적 슬랩스틱입니다. 실제로 따라 하지 마세요.',
    start: '쇼 시작',
    round: '라운드',
    total: '누적',
    best: '최고',
    target: '성공 기준 700점',
    powerTitle: '파워를 정하세요',
    powerHelp: '정중앙 기준 성공 가능 구간을 노려보세요.',
    powerAction: '파워 결정',
    aimTitle: '이제 방향을 정하세요',
    aimHelp: '정중앙이 가장 높은 점수입니다.',
    lowPower: '파워 부족 · 그래도 방향은 정하세요.',
    maxScore: '정중앙 최대 {score}점',
    aimAction: '각도 결정 · 발사',
    sceneTitle: '정체 공개 중',
    sceneHelp: '같은 배우의 전신과 결과를 확인하세요.',
    skip: '연출 건너뛰기',
    gameOver: '런 종료',
    score: '{score}점',
    retry: '다시 도전',
    paused: '게임을 멈췄습니다',
    pausedHelp: '준비되면 같은 지점에서 이어가세요.',
    resume: '이어하기',
    error: '게임을 계속할 수 없습니다',
    errorHelp: '아래 내용을 확인한 뒤 다시 시도하세요.',
    retryLoad: '다시 시도',
    locale: 'English로 전환',
    mute: '소리 끄기',
    unmute: '소리 켜기',
    settings: '설정 열기',
    collection: '도감 열기',
    collectionTitle: '도감',
    charactersLabel: '발견한 배우',
    endingsLabel: '해금한 결말',
    lockedEnding: '잠긴 결말',
    undiscoveredActor: '아직 만나지 못한 배우',
    seenEnding: '감상함',
    newEnding: '새 결말',
    replayEnding: '{character}와 다시 보기',
    closeCollection: '도감 닫기',
    backToCollection: '도감으로',
    settingsTitle: '설정',
    reducedMotion: '움직임 줄이기',
    screenShake: '화면 흔들림',
    minimizeScenes: '연출 짧게 보기',
    closeSettings: '설정 닫기',
    renderError: '3D 화면을 시작하지 못했습니다. 다시 시도해 주세요.',
    storageMemory: '기록을 이 세션의 메모리에 보관합니다.',
    futureStorage: '더 새로운 버전의 저장 기록을 보존했습니다.',
    angle: '수평 각도 {angle}도',
    power: '파워 {power}퍼센트',
    powerValue: '현재 파워 {power}%',
    possibleAtCenter: '정중앙 기준 성공 가능',
    livePower: '파워 단계. 한 번 눌러 파워를 정하세요.',
    liveAim: '각도 단계. 한 번 눌러 발사하세요.',
    liveScene: '정체 공개와 결과 연출이 시작됐습니다.',
    liveResult: '판정 {score}점. {reason}',
    liveGameOver: '런 종료. {score}점. {reason}',
    livePaused: '게임이 멈췄습니다.',
    liveError: '오류. {error}',
  },
  en: {
    brand: 'Poke & Panic',
    strapline: 'You saw the angle. You never saw who was ahead.',
    safety: 'Cartoon slapstick performed by consenting actors aged 20 and over. Do not try this yourself.',
    start: 'Start the show',
    round: 'Round',
    total: 'Total',
    best: 'Best',
    target: '700 points to succeed',
    powerTitle: 'Choose your power',
    powerHelp: 'Aim for the zone marked “possible at center”.',
    powerAction: 'Lock power',
    aimTitle: 'Now choose a direction',
    aimHelp: 'The center gives the highest score.',
    lowPower: 'Low power · choose your direction anyway.',
    maxScore: 'Maximum at center: {score}',
    aimAction: 'Lock angle & fire',
    sceneTitle: 'Revealing the actor',
    sceneHelp: 'See the same actor in full and watch the result.',
    skip: 'Skip scene',
    gameOver: 'Run over',
    score: '{score} pts',
    retry: 'Try again',
    paused: 'Game paused',
    pausedHelp: 'Resume from the same moment when you are ready.',
    resume: 'Resume',
    error: 'The game cannot continue',
    errorHelp: 'Check the message below, then try again.',
    retryLoad: 'Try again',
    locale: '한국어로 전환',
    mute: 'Mute sound',
    unmute: 'Turn sound on',
    settings: 'Open settings',
    collection: 'Open collection',
    collectionTitle: 'Collection',
    charactersLabel: 'Actors discovered',
    endingsLabel: 'Endings unlocked',
    lockedEnding: 'Locked ending',
    undiscoveredActor: 'Actor not discovered yet',
    seenEnding: 'Seen',
    newEnding: 'New',
    replayEnding: 'Replay with {character}',
    closeCollection: 'Close collection',
    backToCollection: 'Back to collection',
    settingsTitle: 'Settings',
    reducedMotion: 'Reduce motion',
    screenShake: 'Screen shake',
    minimizeScenes: 'Shorten scenes',
    closeSettings: 'Close settings',
    renderError: 'The 3D view could not start. Please try again.',
    storageMemory: 'Records will be kept in memory for this session.',
    futureStorage: 'Saved data from a newer version was preserved.',
    angle: 'Horizontal angle {angle} degrees',
    power: 'Power {power} percent',
    powerValue: 'Current power {power}%',
    possibleAtCenter: 'Possible at center',
    livePower: 'Power phase. Press once to lock power.',
    liveAim: 'Aim phase. Press once to fire.',
    liveScene: 'The actor reveal and result scene have started.',
    liveResult: 'Result: {score} points. {reason}',
    liveGameOver: 'Run over. {score} points. {reason}',
    livePaused: 'Game paused.',
    liveError: 'Error. {error}',
  },
} as const;

export type MessageKey = keyof typeof messages.ko;

export function message(locale: Locale, key: MessageKey, values: Readonly<Record<string, string | number>> = {}): string {
  let text: string = messages[locale][key];
  for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

const failureMessages: Record<Locale, Record<FailureType, string>> = {
  ko: {
    HIGH_POWER_MISS: '힘껏 빗나갔어요.',
    MISS: '보호패드에 닿지 않았어요.',
    NEAR_SUCCESS: '거의 성공했어요.',
    UNDERPOWER_HIT: '정확했지만 힘이 부족했어요.',
    OFF_CENTER_HIT: '보호패드 중심에서 벗어났어요.',
  },
  en: {
    HIGH_POWER_MISS: 'A powerful miss.',
    MISS: 'The glove missed the safety pad.',
    NEAR_SUCCESS: 'That was almost enough.',
    UNDERPOWER_HIT: 'Accurate, but not powerful enough.',
    OFF_CENTER_HIT: 'The glove landed away from the center.',
  },
};

export function failureMessage(locale: Locale, failureType: FailureType | null | undefined): string {
  if (failureType === null || failureType === undefined) return locale === 'ko' ? '성공!' : 'Success!';
  return failureMessages[locale][failureType];
}

const actorNames: Record<Locale, Readonly<Record<string, string>>> = {
  ko: {
    iron: '철근 씨', complaint: '민원 여왕', manager: '퇴근 전 팀장', action: '액션 배우',
    yoga: '요가 고수', guard: '미소의 경호원', walker: '산책 챔피언', referee: '비밀 심판',
  },
  en: {
    iron: 'Mr. Rebar', complaint: 'The Complaint Queen', manager: 'The Clock-Watching Manager',
    action: 'The Action Star', yoga: 'The Yoga Master', guard: 'The Smiling Guard',
    walker: 'The Walking Champion', referee: 'The Secret Referee',
  },
};

const endingNames: Record<Locale, Readonly<Record<string, string>>> = {
  ko: {
    'representative-iron': '옷깃 잡힌 날',
    'representative-complaint': '신고는 이미 끝났다',
    'representative-manager': '퇴근이 먼저다',
    'representative-action': '돌아온 장갑',
    'representative-yoga': '매듭이 된 자세',
    'representative-guard': '안전한 퇴장',
    'representative-walker': '격려는 강했다',
    'representative-referee': '레드카드 퇴장',
    'false-relief': '안도의 착각',
    'self-own': '혼자 만든 결말',
    'awkward-miss': '어색한 빗나감',
    'fake-forgiveness': '가짜 용서',
  },
  en: {
    'representative-iron': 'The Rebar Rumble',
    'representative-complaint': 'The Complaint Cuffs',
    'representative-manager': 'Clocking Out Wins',
    'representative-action': 'Return of the Glove',
    'representative-yoga': 'The Tangled Pose',
    'representative-guard': 'A Safe Exit',
    'representative-walker': 'A Little Too Encouraging',
    'representative-referee': 'Red Card Exit',
    'false-relief': 'False Relief',
    'self-own': 'Self-Inflicted Finale',
    'awkward-miss': 'The Awkward Miss',
    'fake-forgiveness': 'Fake Forgiveness',
  },
};

/** Unknown IDs are shown only after the caller has marked that content discovered. */
export function actorName(locale: Locale, id: string): string {
  return actorNames[locale][id] ?? id;
}

/** Unknown IDs are shown only after the caller has marked that content unlocked. */
export function endingName(locale: Locale, id: string): string {
  return endingNames[locale][id] ?? id;
}
