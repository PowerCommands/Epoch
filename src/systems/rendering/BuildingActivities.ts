import type Phaser from 'phaser';
import { drawSewerFlow } from './SewerFlow';
export type BuildingActivity='library'|'circus'|'courthouse'|'colosseum'|'stable'|'stone_works'|'sewers';
const ease=(q:number)=>{const v=Math.max(0,Math.min(1,q));return v*v*(3-2*v);};
export function stoneCranePose(t:number,seed:number) {
  const cycle=(t+seed*12)%12,half=cycle>=6?1:0,phase=cycle%6;
  return {angle:(half+ease((phase-2)/2))*Math.PI,lift:phase<2?ease(phase/2):phase<4?1:1-ease((phase-4)/2)};
}
export function drawBuildingActivity(g:Phaser.GameObjects.Graphics,s:Phaser.GameObjects.Image,kind:BuildingActivity,t:number,seed:number,detail:number):void {
  if(kind==='sewers') {drawSewerFlow(g,s,t,seed,detail);return;}
  const m=s.getWorldTransformMatrix(),size=Math.min(Math.abs(s.width*m.scaleX),Math.abs(s.height*m.scaleY));
  const at=(x:number,y:number)=>m.transformPoint((x-s.originX)*s.width,(y-s.originY)*s.height);
  const alpha=s.alpha*Math.max(.7,detail);
  if(kind==='stone_works') {
    const p=stoneCranePose(t,seed),dx=.17*(Math.cos(p.angle)-1),dy=.04*Math.sin(p.angle);
    const a=at(.72+dx,.183+dy),b=at(.72+dx,.351+dy-p.lift*.14);
    g.lineStyle(Math.max(.65,size*.004),0x775630,alpha);g.lineBetween(a.x,a.y,b.x,b.y);return;
  }
  if(kind==='library'||kind==='circus'||kind==='courthouse') {
    const judges=kind==='courthouse',circus=kind==='circus';
    const start=circus?[.73,.91]:judges?[.27,.77]:[.37,.78];
    const end=circus?[.582,.706]:judges?[.435,.527]:[.426,.576];
    const count=circus?6:4;
    for(let n=0;n<count;n++) {
      const q=(t/(circus?9:7)+seed+n/count)%1;
      const p=at(start[0]+(end[0]-start[0])*q,start[1]+(end[1]-start[1])*q);
      const fade=alpha*Math.min(1,q*12,(1-q)*12),h=size*(judges?.048:.043);
      const stride=Math.sin(t*9+n*2)*h*.16;
      g.lineStyle(Math.max(.7,h*.12),judges?0x171821:0x454650,fade);
      g.lineBetween(p.x-h*.12,p.y-h*.24,p.x-h*.13+stride,p.y);
      g.lineBetween(p.x+h*.12,p.y-h*.24,p.x+h*.13-stride,p.y);
      g.fillStyle(judges?0x15151d:[0xb55740,0x536c98,0xd3af61,0x528778][n%4],fade);
      g.fillTriangle(p.x,p.y-h*.78,p.x-h*.23,p.y-h*.18,p.x+h*.23,p.y-h*.18);
      g.fillStyle(0xd8b18d,fade).fillCircle(p.x,p.y-h*.89,h*.14);
      if(judges) {
        g.fillStyle(0xf6eee0,fade).fillRect(p.x-h*.08,p.y-h*.71,h*.16,h*.13);
        g.fillStyle(0x765033,fade).fillRect(p.x+h*.1,p.y-h*.58,h*.24,h*.30);
        g.fillStyle(0xe4d6ad,fade).fillRect(p.x+h*.13,p.y-h*.55,h*.19,h*.04);
      }
    }return;
  }
  if(kind==='colosseum') {
    for(let row=0;row<4;row++)for(let n=0;n<19;n++) {
      const a=Math.PI+(n+.3)*Math.PI/19,p=at(.54+Math.cos(a)*(.17+row*.012),.423+Math.sin(a)*(.07+row*.016));
      const h=size*.018;
      g.fillStyle([0x8e4734,0x354d70,0xd5ad66,0x657446][(n+row)%4],alpha).fillEllipse(p.x,p.y,h*.75,h);
      g.fillStyle(0xd5ad83,alpha).fillCircle(p.x,p.y-h*.6,h*.3);
      if((n+row*3)%8===0) {
        const tilt=Math.sin(t*5+n+row)*size*.009,top=p.y-size*.04;
        g.lineStyle(Math.max(.5,size*.0025),0x69452e,alpha);g.lineBetween(p.x,p.y,p.x+tilt,top);
        g.fillStyle([0xcf4937,0xe3bb4f,0x568dbd][n%3],alpha);
        g.fillTriangle(p.x+tilt,top,p.x+tilt+size*.027,top+Math.sin(t*6+n)*size*.007,p.x+tilt,top+size*.019);
      }
    }return;
  }
  for(let n=0;n<3;n++) {
    const q=.5+.5*Math.sin(t*1.8+n*2+seed*6),p=at(.302+n*.104,.484+n*.066+q*.014);
    const h=size*.065,color=[0x865234,0xbf9660,0x65402d][n];
    g.fillStyle(color,alpha).fillEllipse(p.x,p.y,h*.52,h*(.55+q*.3));
    g.fillEllipse(p.x-h*.18,p.y+h*.23,h*.55,h*.38);
    g.fillTriangle(p.x-h*.20,p.y-h*.28,p.x-h*.16,p.y-h*.64,p.x-h*.04,p.y-h*.30);
    g.fillTriangle(p.x+h*.05,p.y-h*.31,p.x+h*.17,p.y-h*.62,p.x+h*.22,p.y-h*.22);
    g.fillStyle(0x30251f,alpha).fillEllipse(p.x-h*.25,p.y+h*.29,h*.32,h*.16);
    g.fillCircle(p.x-h*.14,p.y-h*.11,h*.048);
  }
}
