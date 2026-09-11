export class GameSound {
  private context: AudioContext | null = null;
  async unlock(): Promise<void> {
    try {
      this.context ??= new AudioContext();
      if(this.context.state==='suspended') await this.context.resume();
    } catch { /* Browser denial leaves all gameplay feedback available visually. */ }
  }
  play(kind:'lock'|'fire'|'success'|'failure', muted:boolean):void {
    const context=this.context;
    if(muted || !context || context.state!=='running')return;
    const oscillator=context.createOscillator(),gain=context.createGain();
    const now=context.currentTime;
    oscillator.type=kind==='fire'?'triangle':'sine';
    oscillator.frequency.setValueAtTime(kind==='success'?660:kind==='failure'?180:kind==='fire'?340:480,now);
    oscillator.frequency.exponentialRampToValueAtTime(kind==='success'?990:120,now+.14);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.05,now+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+.2);
    oscillator.connect(gain).connect(context.destination);oscillator.start(now);oscillator.stop(now+.22);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
  dispose():void {void this.context?.close().catch(()=>{});this.context=null;}
}
