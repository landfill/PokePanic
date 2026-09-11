import type { ReplayRecorder } from './debug/recorder';
import type { CapturedReplayRound, ReplayFinishPolicy } from './game/replay';
import { TUNING } from './game/config';
import { GameSession } from './game/session';
import { RunController, type AdjudicatedShot } from './game/run';
import { GameClock } from './game/clock';
import { CharacterBag } from './game/character-bag';
import { SeededRandom } from './game/random';
import { centerSuccessBoundaryPercent } from './game/scoring';
import { bindActionInput } from './input/action-input';
import { createGameUI, type UIPhase } from './ui/game-ui';
import { createCollectionUI } from './ui/collection';
import { GameStage } from './scene/stage';
import { GameSound } from './audio/sound';
import { loadProfile, type ProfileV1 } from './storage/profile';
import { actorName, endingName, message } from './i18n/messages';
import { ScenePlayback, type PlaybackEvent } from './animation/playback';
import { selectEnding } from './endings/select';
import { ENDINGS, ENDING_IDS, RUNTIME_CHARACTERS, fallbackFor, getEnding, type RuntimeCharacterId } from './endings/runtime';
import { recordCharacterDiscovery, recordEndingSeen, recordEndingUnlock } from './endings/collection';

const host=document.querySelector<HTMLElement>('#app')!;
const stageHost=document.createElement('div');stageHost.className='game-stage';host.append(stageHost);
const seed=crypto.getRandomValues(new Uint32Array(1))[0]!;
const persistence=loadProfile({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)}, {
  characterIds:RUNTIME_CHARACTERS,endingIds:ENDING_IDS,browserLocales:navigator.languages,
  prefersReducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,initialCharacterRngState:seed,
});
let profile=persistence.profile;
const initialReplayProfile=profile;
let recorder:ReplayRecorder|null=null;
let currentPrepared:CapturedReplayRound['prepared']|null=null;
let finishPolicy:ReplayFinishPolicy='normal';
const bag=new CharacterBag(RUNTIME_CHARACTERS,seed,profile.bag);
const placementRandom=new SeededRandom((seed^0x14eb2)>>>0);
const endingRandom=new SeededRandom((seed^0x810836)>>>0);
const session=new GameSession();
const sound=new GameSound();
let stage:GameStage|null=null;
let started=false,paused=false,rendererError=false;
let detachInput:(()=>void)|null=null;
let playback:ScenePlayback|null=null;
let currentCharacter:RuntimeCharacterId='iron';
let currentPlacement=0;
let pendingPlacement:{roundId:number;x:number}|null=null;
let frame=0;
let preview:{playback:ScenePlayback;clock:GameClock}|null=null;

function save(next=profile):void {profile=persistence.save(next);}
function pause():void {
  if((!started&&!preview)||paused)return;
  const now=performance.now();session.pause(now);preview?.clock.pause(now);paused=true;render();
}
function ensureStage():void {
  if(stage)return;
  stage=new GameStage(stageHost,()=>{pause();rendererError=true;render();},()=>{rendererError=false;render();});
}
function prepare():void {
  const reservation=bag.peek();
  try{
    ensureStage();
    currentCharacter=reservation.characterId as RuntimeCharacterId;
    const round=session.runView();
    if(pendingPlacement?.roundId!==round.currentRoundId)pendingPlacement={roundId:round.currentRoundId,
      x:round.roundNumber===1?0:(placementRandom.next()*2-1)*.19};
    currentPlacement=pendingPlacement.x;
    const geometry=stage!.prepare(currentCharacter,currentPlacement);
    const prepared={...geometry,powerPeriodMs:TUNING.powerPeriodMs,anglePeriodMs:TUNING.anglePeriodMs,powerPhase:0,anglePhase:0};
    if(!session.prepareCurrentRound({...prepared,roundId:round.currentRoundId,startWallTime:performance.now()}))return;
    currentPrepared=prepared;
    bag.commit(reservation.token);save({...profile,bag:bag.snapshot()});
    pendingPlacement=null;playback=null;rendererError=false;
    if(paused)session.pause(performance.now());
  }catch(error){console.error('Round preparation failed',error);rendererError=true;}
  render();
}
function start():void {void sound.unlock();started=true;prepare();}
function resume():void {
  if(rendererError){
    stage?.dispose();stage=null;rendererError=false;
    if(!session.sample(performance.now()).input&&!preview){prepare();return;}
    try{ensureStage();stage!.prepare(preview?.playback.characterId??currentCharacter,preview?0:currentPlacement);}
    catch{rendererError=true;render();return;}
  }
  if(paused){const now=performance.now();if(preview)preview.clock.resume(now);else session.resume(now);paused=false;}
  render();
}
function finishRunScene(roundId:number):void {
  if(session.runView().status!=='SCENE'||session.runView().currentRoundId!==roundId)return;
  const after=session.finishScene(roundId);
  save({...profile,bestScore:Math.max(profile.bestScore,after.totalScore),bestStreak:Math.max(profile.bestStreak,after.streak)});
  if(recorder&&currentPrepared&&playback){
    const shot=playback.shot;
    recorder.recordRound({roundId,prepared:currentPrepared,inputGameTimeMs:[shot.input.powerLockedAtMs,shot.input.firedAtMs],finishPolicy,settingsAfter:profile.settings},
      {characterId:currentCharacter,rawScore:shot.score.rawScore,failureType:shot.failureType,endingId:playback.endingId,runId:after.runId,runTotal:after.totalScore,streak:after.streak,bagCursor:profile.bag.cursor,unlockedEndingIds:profile.unlockedEndingIds,seenEndingIds:profile.seenEndingIds},profile,endingRandom.state());
  }
  if(after.status==='PLAYING')prepare();
}
function applyEvents(events:readonly PlaybackEvent[],fromPreview=false):void {
  let next:ProfileV1=profile;
  for(const event of events){
    if(event.type==='DISCOVER'&&!fromPreview){next=recordCharacterDiscovery(next,event.characterId,RUNTIME_CHARACTERS);sound.play(playback?.shot.score.isSuccess?'success':'failure',profile.settings.muted);}
    else if(event.type==='UNLOCK'&&!fromPreview)next=recordEndingUnlock(next,event.endingId,ENDING_IDS);
    else if(event.type==='SEEN')next=recordEndingSeen(next,event.endingId,ENDING_IDS);
  }
  if(next!==profile)save(next);
  for(const event of events)if(event.type==='FINISH'){
    if(fromPreview)endPreview();else finishRunScene(event.roundId);
  }
}
function lockShot(shot:AdjudicatedShot):void {
  finishPolicy=profile.settings.minimizeScenes?'minimized':'normal';
  const selection=selectEnding({characterId:currentCharacter,failureType:shot.failureType,candidates:ENDINGS,
    seenEndingIds:profile.seenEndingIds,random:()=>endingRandom.next(),fallbackByFailure:fallbackFor(currentCharacter)});
  if(selection?.usedFallback)console.error('Runtime ending registry missing a compatible scene');
  playback=new ScenePlayback(currentCharacter,shot,{endingId:selection?.endingId??null,
    alreadySeen:selection?profile.seenEndingIds.includes(selection.endingId):false,minimizeScenes:profile.settings.minimizeScenes});
  sound.play('fire',profile.settings.muted);
}
function render():void {
  const current=session.sample(performance.now());
  const shown=preview?.playback??playback;
  const scene=shown?.view();
  const phase:UIPhase=rendererError?'ERROR':preview?(paused?'PAUSED':'SCENE'):!started?'MENU':paused?'PAUSED':
    current.run.status==='GAME_OVER'?'GAME_OVER':current.run.status==='SCENE'?'SCENE':current.input?.stage==='AIM'?'AIM':'POWER';
  ui.render({phase,locale:profile.settings.locale,powerPercent:current.input?.powerPercent??0,
    angleDegrees:current.input?.angleDegrees??0,maxRawScore:current.input?.maxRawScore??0,
    canStillSucceed:current.input?.canStillSucceed??false,roundNumber:current.run.roundNumber,totalScore:current.run.totalScore,
    bestScore:profile.bestScore,muted:profile.settings.muted,rawScore:shown?.shot.score.rawScore??0,
    failureType:shown?.shot.failureType??null,showScore:(scene?.elapsedMs??0)>=450,canSkip:scene?.canSkip??false,
    error:rendererError?message(profile.settings.locale,'renderError'):''});
  document.documentElement.lang=profile.settings.locale;host.dataset.phase=phase;
  const accept=!preview&&(phase==='POWER'||phase==='AIM');
  if(accept&&!detachInput)detachInput=bindActionInput({element:ui.action,
    onPress:token=>{
      void sound.unlock();const view=session.press(token,performance.now());
      if(view.run.shot&&!playback)lockShot(view.run.shot);else sound.play('lock',profile.settings.muted);
      render();
    },onRelease:token=>session.release(token),onSuspend:pause});
  else if(!accept&&detachInput){const detach=detachInput;detachInput=null;detach();}
  storageNotice.textContent=persistence.writable?'':message(profile.settings.locale,persistence.status==='future-schema'?'futureStorage':'storageMemory');
  storageNotice.hidden=persistence.writable;
  previewClose.hidden=!preview;previewClose.textContent=message(profile.settings.locale,'backToCollection');
}
const ui=createGameUI(host,{
  onStart:start,onRetry:()=>{recorder?.markRetry();session.retry();prepare();},onResume:resume,
  onSkip:()=>{const shown=preview?.playback??playback;if(shown){if(!preview&&shown.view().canSkip)finishPolicy='skip';applyEvents(shown.skip(),preview!==null);}render();},
  onLocale:locale=>{save({...profile,settings:{...profile.settings,locale}});render();},
  onMute:muted=>{save({...profile,settings:{...profile.settings,muted}});render();},
  onSettings:openSettings,onCollection:openCollection,
});
const storageNotice=document.createElement('p');storageNotice.className='storage-notice';storageNotice.setAttribute('role','status');host.append(storageNotice);
const settings=document.createElement('dialog');settings.className='settings-dialog';host.append(settings);
const collection=createCollectionUI(host,{onReplay:beginPreview,onClose:render});
const previewClose=document.createElement('button');previewClose.className='preview-close';previewClose.hidden=true;previewClose.onclick=()=>endPreview();host.append(previewClose);
function openSettings():void {
  pause();settings.replaceChildren();
  const title=document.createElement('h2');title.textContent=message(profile.settings.locale,'settingsTitle');settings.append(title);
  for(const key of ['reducedMotion','screenShake','minimizeScenes'] as const){
    const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=profile.settings[key];
    input.addEventListener('change',()=>save({...profile,settings:{...profile.settings,[key]:input.checked}}));
    label.append(input,document.createTextNode(message(profile.settings.locale,key)));settings.append(label);
  }
  const close=document.createElement('button');close.textContent=message(profile.settings.locale,'closeSettings');close.onclick=()=>settings.close();settings.append(close);settings.showModal();
}
function openCollection():void {
  if(preview)endPreview(false);
  pause();
  collection.open({...profile,locale:profile.settings.locale,
    characters:RUNTIME_CHARACTERS.map(id=>({id,name:actorName(profile.settings.locale,id)})),
    endings:ENDINGS.map(ending=>({id:ending.id,name:endingName(profile.settings.locale,ending.id),characterIds:ending.characterIds}))});
}
function beginPreview(endingId:string,characterId:string,forced=false):void {
  const ending=getEnding(endingId);
  if(!ending.characterIds.some(id=>id===characterId)||(!forced&&(!profile.unlockedEndingIds.includes(endingId)||!profile.discoveredCharacterIds.includes(characterId))))return;
  if(forced)pause();
  collection.close();
  try{
    ensureStage();const geometry=stage!.prepare(characterId as RuntimeCharacterId);
    const type=ending.failureTypes[0]!;
    const power=type==='HIGH_POWER_MISS'?100:type==='NEAR_SUCCESS'?centerSuccessBoundaryPercent()-.000001:60;
    const angle=type==='MISS'||type==='HIGH_POWER_MISS'?60:0;
    const shot=new RunController().adjudicateFire({...geometry,roundId:1,powerPercent:power,angleDegrees:angle,powerLockedAtMs:0,firedAtMs:0})!;
    const instance=new ScenePlayback(characterId as RuntimeCharacterId,shot,{endingId,alreadySeen:profile.seenEndingIds.includes(endingId),minimizeScenes:false});
    preview={playback:instance,clock:new GameClock(performance.now())};paused=false;
  }catch{rendererError=true;}
  render();
}
function endPreview(reopen=true):void {
  if(!preview)return;
  preview.playback.cleanup();preview=null;
  // Rebuild only the visual actor. The live session keeps its frozen shot/input,
  // profile, random streams and character bag; returning never resumes it.
  if(started){stage?.prepare(currentCharacter,currentPlacement);paused=true;}else paused=false;
  if(reopen)openCollection();render();
}
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
function tick():void {
  const now=performance.now();
  if(preview){
    const active=preview;
    if(!paused)applyEvents(active.playback.update(active.clock.now(now)),true);
    if(preview)stage?.draw(active.playback.shot.input.angleDegrees,active.playback.shot,active.playback.view().elapsedMs,
      profile.settings.reducedMotion,profile.settings.screenShake,active.playback.endingId??undefined);
  }else{
    const current=session.sample(now);
    if(current.input&&playback&&current.run.status==='SCENE'&&!paused){
      const active=playback;applyEvents(active.update(current.input.gameTimeMs));
    }
    if(stage&&started)stage.draw(current.input?.stage==='POWER'?0:current.input?.angleDegrees??playback?.shot.input.angleDegrees??0,
      playback?.shot??null,playback?.view().elapsedMs??0,profile.settings.reducedMotion,profile.settings.screenShake,playback?.endingId??undefined);
  }
  render();frame=requestAnimationFrame(tick);
}
async function boot():Promise<void>{
  if(import.meta.env.DEV){
    const [{ReplayRecorder},{createDebugPanel}]=await Promise.all([import('./debug/recorder'),import('./debug/panel')]);
    recorder=new ReplayRecorder(initialReplayProfile,endingRandom.state());
    createDebugPanel(host,{characters:RUNTIME_CHARACTERS,endings:ENDINGS,
      getFixture:()=>recorder?.export()??null,
      getDiagnostics:()=>({run:session.runView(),input:session.sample(performance.now()).input,bag:bag.snapshot(),endingRngState:endingRandom.state(),renderer:stage?{calls:stage.renderer.info.render.calls,triangles:stage.renderer.info.render.triangles,memory:stage.renderer.info.memory}:null}),
      onPreview:(characterId,endingId)=>beginPreview(endingId,characterId,true)});
  }
  render();frame=requestAnimationFrame(tick);
}
void boot();
window.addEventListener('pagehide',event=>{cancelAnimationFrame(frame);if(event.persisted){pause();return;}detachInput?.();stage?.dispose();sound.dispose();collection.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted)frame=requestAnimationFrame(tick);});
