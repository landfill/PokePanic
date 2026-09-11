import { FailureTimeline } from './timeline';
import type { AdjudicatedShot } from '../game/run';
import { getEnding, REVEAL_END_MS, SUCCESS_END_MS, type RuntimeCharacterId } from '../endings/runtime';

export type PlaybackEvent = Readonly<{type:'DISCOVER';characterId:RuntimeCharacterId;roundId:number}>
  | Readonly<{type:'UNLOCK'|'SEEN';endingId:string;roundId:number}>
  | Readonly<{type:'FINISH';roundId:number}>;

/** Presentation clock contract shared by real play and an isolated collection
 * preview. This object cannot award score, consume a bag, or mutate a profile. */
export class ScenePlayback {
  private timeline:FailureTimeline|null=null;
  private entered=false;
  private finished=false;
  private discovered=false;
  private elapsed=0;
  private lastGameTime:number;
  private readonly canSkipFromStart:boolean;
  private readonly minimizeScenes:boolean;
  readonly endingId:string|null;

  constructor(readonly characterId:RuntimeCharacterId, readonly shot:AdjudicatedShot,
    options:{endingId:string|null;alreadySeen:boolean;minimizeScenes:boolean}) {
    this.lastGameTime=shot.input.firedAtMs;
    this.endingId=options.endingId;
    this.canSkipFromStart=options.alreadySeen||options.minimizeScenes;
    this.minimizeScenes=options.minimizeScenes;
    if(shot.score.isSuccess){
      if(options.endingId!==null)throw new RangeError('Successful shot cannot have a failure ending');
    }else{
      if(options.endingId===null)throw new RangeError('Failed shot requires an ending');
      const ending=getEnding(options.endingId);
      if(!ending.characterIds.includes(characterId)||!ending.failureTypes.includes(shot.failureType!))throw new RangeError('Incompatible ending');
      this.timeline=new FailureTimeline({roundId:shot.roundId,endingId:ending.id,durationMs:ending.durationMs,coreAtMs:ending.coreAtMs,
        alreadySeen:options.alreadySeen,minimizeScenes:options.minimizeScenes});
    }
  }

  view():Readonly<{elapsedMs:number;canSkip:boolean;finished:boolean}> {
    const core=this.endingId?getEnding(this.endingId).coreAtMs:Infinity;
    return Object.freeze({elapsedMs:this.elapsed,finished:this.finished,
      canSkip:!this.finished&&this.entered&&(this.canSkipFromStart||this.elapsed>=REVEAL_END_MS+core)});
  }

  update(gameTime:number):readonly PlaybackEvent[] {
    if(this.finished)return [];
    if(!Number.isFinite(gameTime)||gameTime<this.lastGameTime)throw new RangeError('Playback clock must be monotonic');
    this.lastGameTime=gameTime;this.elapsed=gameTime-this.shot.input.firedAtMs;
    const events:PlaybackEvent[]=[];
    if(this.elapsed>=REVEAL_END_MS&&!this.discovered){
      this.discovered=true;events.push(Object.freeze({type:'DISCOVER',characterId:this.characterId,roundId:this.shot.roundId}));
    }
    if(this.timeline&&this.elapsed>=REVEAL_END_MS){
      if(!this.entered){this.entered=true;events.push(...this.convert(this.timeline.enter(this.shot.roundId,this.shot.input.firedAtMs+REVEAL_END_MS)));}
      if(this.minimizeScenes)events.push(...this.convert(this.timeline.finish(this.shot.roundId,'skip')));
      else events.push(...this.convert(this.timeline.update(this.shot.roundId,gameTime)));
    }else if(!this.timeline&&this.elapsed>=SUCCESS_END_MS){
      this.finished=true;events.push(Object.freeze({type:'FINISH',roundId:this.shot.roundId}));
    }
    return events;
  }
  skip():readonly PlaybackEvent[] {
    if(!this.view().canSkip||!this.timeline)return [];
    return this.convert(this.timeline.finish(this.shot.roundId,'skip'));
  }
  cleanup():void {this.timeline?.cleanup(this.shot.roundId);this.finished=true;}

  private convert(events:ReturnType<FailureTimeline['update']>):PlaybackEvent[]{
    const result:PlaybackEvent[]=[];
    for(const event of events){
      if(event.type==='FINISH'){this.finished=true;result.push(Object.freeze({type:'FINISH',roundId:event.roundId}));}
      else if(event.type==='UNLOCK'||event.type==='SEEN')result.push(event);
    }
    return result;
  }
}
