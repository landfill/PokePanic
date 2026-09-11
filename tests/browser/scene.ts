import { GameStage } from '../../src/scene/stage';
import { RunController } from '../../src/game/run';
import { centerSuccessBoundaryPercent } from '../../src/game/scoring';
import type { RuntimeCharacterId } from '../../src/endings/runtime';

const host=document.querySelector<HTMLElement>('#scene')!;
const stage=new GameStage(host,()=>{},()=>{});
let current:ReturnType<RunController['adjudicateFire']>=null;
let endingId:string|undefined;
let characterId:RuntimeCharacterId='iron';
const output=document.querySelector<HTMLOutputElement>('#details')!;
function prepare(character:RuntimeCharacterId,ending:string,power?:number,angle?:number){
  characterId=character;endingId=ending==='success'?undefined:ending;
  const geometry=stage.prepare(character);
  const shotPower=power??(ending==='self-own'||ending==='success'?100:ending==='false-relief'?centerSuccessBoundaryPercent()-.000001:60);
  const shotAngle=angle??(ending==='awkward-miss'||ending==='self-own'?60:0);
  current=new RunController().adjudicateFire({...geometry,roundId:1,powerPercent:shotPower,angleDegrees:shotAngle,powerLockedAtMs:0,firedAtMs:0});
  draw(0);
}
function draw(time:number){stage.draw(current?.input.angleDegrees??0,current,time,false,false,endingId);output.textContent=JSON.stringify({characterId,endingId,time,score:current?.score.rawScore,failureType:current?.failureType,drawCalls:stage.renderer.info.render.calls,triangles:stage.renderer.info.render.triangles,geometries:stage.renderer.info.memory.geometries});}
declare global{interface Window{sceneFixture:{prepare:typeof prepare;draw:typeof draw;aim:()=>void}}}
window.sceneFixture={prepare,draw,aim:()=>stage.draw(0,null)};
prepare('iron','representative-iron');stage.draw(0,null);
