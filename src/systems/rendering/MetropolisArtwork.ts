import type Phaser from 'phaser';
import { cityContains, cityRailCorridor, type CityArtwork, type CityPoint } from './OrganicCityArtwork';

/** Shared deterministic layout for baked architecture and the living-world batch.
 * The central hex always supplies land for landmarks, even on coastal sites. */
export function metropolisLayout(land: CityPoint[][], size: number) {
  return { runway: cityRailCorridor(land, size), stadium: {x:.22*size,y:.02*size},
    towers: [{x:-.30*size,y:-.18*size},{x:-.16*size,y:-.21*size}],
    signs: [{x:.08*size,y:-.40*size},{x:.34*size,y:-.53*size},{x:-.35*size,y:.16*size}] };
}
export function drawMetropolis(ctx: CanvasRenderingContext2D, land: CityPoint[][], size: number, damaged = false): CityArtwork {
  const fires: CityPoint[] = [];
  const layout=metropolisLayout(land,size), polygons=land.map(poly=>poly.map(p=>({x:p.x/size,y:p.y/size})));
  const inside=(x:number,y:number)=>polygons.some(poly=>cityContains(poly,{x,y}));
  ctx.save();ctx.scale(size,size);
  ctx.beginPath();for(const poly of polygons){poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
  ctx.fillStyle='#637477';ctx.fill();ctx.save();ctx.clip();
  // Wide divided boulevard, cross streets and regularly spaced street trees.
  ctx.fillStyle='#29383f';ctx.fillRect(-1.5,.13,3,.16);
  for(let x=-1.25;x<1.5;x+=.32){ctx.fillRect(x,-1.3,.045,2.6);}
  ctx.fillStyle='#a2afa9';ctx.fillRect(-1.5,.198,3,.02);
  for(let x=-1.4;x<1.5;x+=.12){ctx.fillStyle='#e4d9a1';ctx.fillRect(x,.16,.055,.008);ctx.fillRect(x,.255,.055,.008);ctx.fillStyle='#386852';ctx.beginPath();ctx.arc(x,.208,.019,0,Math.PI*2);ctx.fill();}
  const runway=layout.runway;
  const ry=runway.y/size, left=runway.left/size, width=(runway.right-runway.left)/size;
  ctx.fillStyle='#b3bdbe';ctx.fillRect(left,ry-.065,width,.13);
  ctx.fillStyle='#36404b';ctx.fillRect(left,ry-.038,width,.075);
  ctx.fillStyle='#f2ecbc';for(let x=left+.03;x<left+width-.03;x+=.10)ctx.fillRect(x,ry-.004,.05,.008);
  ctx.restore();
  let buildingIndex = 0;
  const box=(x:number,y:number,w:number,h:number,color:string)=>{
    const ruined = damaged && buildingIndex++ % 3 !== 1;
    if (ruined) { h *= .55; color = '#566063'; }
    ctx.fillStyle='#273c4a';ctx.beginPath();ctx.moveTo(x+w,y);ctx.lineTo(x+w+.035,y-.035);ctx.lineTo(x+w+.035,y-h-.035);ctx.lineTo(x+w,y-h);ctx.closePath();ctx.fill();
    ctx.fillStyle=color;ctx.fillRect(x,y-h,w,h);
    ctx.fillStyle='#c4d9db';ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x+.035,y-h-.035);ctx.lineTo(x+w+.035,y-h-.035);ctx.lineTo(x+w,y-h);ctx.closePath();ctx.fill();
    for(let yy=y-h+.025;yy<y-.012;yy+=.033)for(let xx=x+.013;xx<x+w-.01;xx+=.026){ctx.fillStyle=(Math.round((xx+yy)*100)%3)?'#99cad5':'#ffe4a0';ctx.fillRect(xx,yy,.012,.016);}
    if (ruined) {
      ctx.fillStyle='#242d31';ctx.beginPath();
      ctx.moveTo(x,y-h);ctx.lineTo(x+w*.22,y-h*.78);ctx.lineTo(x+w*.4,y-h*.98);
      ctx.lineTo(x+w*.65,y-h*.6);ctx.lineTo(x+w,y-h*.86);ctx.lineTo(x+w,y-h);ctx.closePath();ctx.fill();
      ctx.fillStyle='#252a2b';ctx.fillRect(x+w*.23,y-h*.65,w*.48,h*.52);
      ctx.strokeStyle='#9b9c91';ctx.lineWidth=.007;
      for(let yy=y-h*.65;yy<y-.02;yy+=.04){ctx.beginPath();ctx.moveTo(x+w*.22,yy);ctx.lineTo(x+w*.75,yy+.015);ctx.stroke();}
      for(let j=0;j<7;j++){ctx.fillStyle=j%2?'#afb0a4':'#4b5151';ctx.fillRect(x-.02+j*w/6,y-.005+(j%2)*.014,.023,.014);}
      fires.push({x:(x+w*.5)*size,y:(y-h*.35)*size});
    }
  };
  // Dense skyline: broad glass office slabs, stepped crowns and slim spires.
  let index=0;
  for(let y=-1.04;y<1.08;y+=.19)for(let x=-1.22;x<1.25;x+=.155){
    index++;
    if(!inside(x,y)||!inside(x+.13,y)||!inside(x,y-.07))continue;
    if(y>.10&&y<.34 || Math.abs(y-ry)<.14 || (x>-.49&&x<.57&&y>-.42&&y<.12))continue;
    const h=y<-.35?.25+(Math.sin(index*13.7)+1)*.21:.15+(index%4)*.040;
    box(x,y,.105+(index%2)*.02,h,['#4e7788','#527083','#698a95','#425c74'][index%4]);
    if(h>.52 && !damaged){box(x+.027,y-h,.05,.06,'#759ca7');ctx.strokeStyle='#dbe3dd';ctx.lineWidth=.006;ctx.beginPath();ctx.moveTo(x+.055,y-h-.06);ctx.lineTo(x+.055,y-h-.16);ctx.stroke();}
  }
  // Nuclear generation campus with hyperboloid cooling towers and dark open rims.
  box(-.44,-.07,.13,.10,'#9aa9aa');
  for(const t of layout.towers){const x=t.x/size,y=t.y/size;ctx.fillStyle='#c2cecb';ctx.beginPath();ctx.moveTo(x-.07,y);ctx.bezierCurveTo(x-.025,y-.09,x-.028,y-.15,x-.055,y-.20);ctx.lineTo(x+.055,y-.20);ctx.bezierCurveTo(x+.028,y-.15,x+.025,y-.09,x+.07,y);ctx.closePath();ctx.fill();ctx.fillStyle='#536d75';ctx.beginPath();ctx.ellipse(x,y-.20,.055,.018,0,0,Math.PI*2);ctx.fill();}
  // Stadium bowl, crowd terraces, pitch, floodlights and entry concourse.
  const sx=layout.stadium.x/size,sy=layout.stadium.y/size;
  for(const [rx,ry,color] of [[.25,.135,'#d7dedc'],[.218,.110,'#334758'],[.17,.08,'#bb7371'],[.14,.065,'#408a60']] as const){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(sx,sy,rx,ry,0,0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle='#deeed5';ctx.lineWidth=.004;ctx.strokeRect(sx-.11,sy-.043,.22,.086);ctx.beginPath();ctx.ellipse(sx,sy,.027,.027,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(sx,sy-.043);ctx.lineTo(sx,sy+.043);ctx.stroke();
  for(let i=0;i<100;i++){const a=i*2.399,r=.85+(i%3)*.065;ctx.fillStyle=['#efcaaa','#ede6b4','#62abc2','#c94d5c'][i%4];ctx.fillRect(sx+Math.cos(a)*.20*r,sy+Math.sin(a)*.099*r,.006,.006);}
  for(const dx of [-.23,.23]){ctx.fillStyle='#b9c9cc';ctx.fillRect(sx+dx,sy-.12,.006,.11);ctx.fillStyle='#fff6c6';ctx.fillRect(sx+dx-.027,sy-.13,.06,.018);}
  // Airport terminal, boarding bridges and control tower alongside the runway.
  box(left+.06,ry-.06,Math.min(.36,width*.48),.065,'#81a7b2');
  box(left+.025,ry-.07,.04,.15,'#799399');
  for(let i=0;i<3;i++){ctx.fillStyle='#d1d9d6';ctx.fillRect(left+.10+i*.075,ry-.055,.012,.04);}
  for(const sign of layout.signs){const x=sign.x/size,y=sign.y/size;ctx.fillStyle='#162b40';ctx.fillRect(x-.07,y-.026,.15,.06);ctx.fillStyle='#5af1e3';ctx.fillRect(x-.062,y-.019,.134,.042);ctx.fillStyle='#223c62';ctx.font='bold 0.026px sans-serif';ctx.fillText('EPOCH',x-.052,y+.012,.12);}
  ctx.restore();return {smoke:[],engines:[],occluders:[],fires};
}

/** One bounded batch: no actors, timers, simulation or gameplay side effects. */
export function drawMetropolisActivity(g: Phaser.GameObjects.Graphics, land: CityPoint[][], s:number, time:number, phase:number) {
  const {runway,stadium,towers,signs}=metropolisLayout(land,s);
  const t=time/1000;
  for(const [i,p] of towers.entries())for(let j=0;j<8;j++){
    const age=(t/6+j/8+i*.37)%1;
    g.fillStyle(0xe9f4ef,(1-age)*.48);g.fillEllipse(p.x+age*s*.09,p.y-s*.20-age*s*.28,s*(.045+age*.10),s*(.035+age*.085));
  }
  for(const [i,p] of signs.entries()){
    g.fillStyle([0x50eee0,0xff76b0,0xffd571][i],.35+.25*Math.sin(t*1.7+i*2));g.fillRect(p.x-s*.063,p.y-s*.019,s*.134,s*.042);
    for(let j=0;j<4;j++){g.fillStyle(0xffffff,.75);g.fillRect(p.x+s*(-.05+j*.028),p.y+s*(-.008+.005*Math.sin(t+j)),s*.018,s*.006);}
  }
  for(let i=0;i<12;i++){
    const x=(((t/20+i/12+phase*.01)%1)*2.7-1.35)*s, y=s*(i%2?.25:.16);
    if(!land.some(poly=>cityContains(poly,{x,y})))continue;
    g.fillStyle([0xd9e5e6,0x304c67,0xc15b4c,0xe8c469][i%4],1);g.fillRoundedRect(x,y-s*.012,s*.047,s*.021,s*.005);g.fillStyle(0x99c9dc,1);g.fillRect(x+s*.012,y-s*.010,s*.019,s*.016);
  }
  // Alternating approach/touchdown and accelerating climb, confined to the shell.
  for(let i=0;i<2;i++){
    const f=(t/24+i*.5+phase*.003)%1, direction=i?-1:1;
    const x=i?runway.right-f*(runway.right-runway.left):runway.left+f*(runway.right-runway.left);
    const altitude=i?Math.max(0,.5-f)*s*.42:Math.max(0,f-.55)*s*.48;
    const y=runway.y-altitude;
    g.fillStyle(0x152a35,.20);g.fillEllipse(x,runway.y+s*.018,s*.09,s*.025);
    g.lineStyle(s*.012,0xf1f5ee,1);g.lineBetween(x-s*.045,y,x+s*.045,y);g.lineBetween(x,y-s*.047,x+s*.017*direction,y+s*.047);g.lineStyle(s*.006,0x5ba5ca,1);g.lineBetween(x-s*.035*direction,y-s*.020,x-s*.035*direction,y+s*.020);
  }
  for(let i=0;i<16;i++){
    const a=i*Math.PI*2/16,x=stadium.x+Math.cos(a)*s*.20,y=stadium.y+Math.sin(a)*s*.097;
    g.fillStyle(i%2?0xffd6a1:0x77cadd,.9);g.fillCircle(x,y+Math.sin(t*2+i)*s*.002,s*.004);
    if(i%4===0){g.lineStyle(s*.003,0xdbe8e4,1);g.lineBetween(x,y,x,y-s*.035);g.fillStyle(i%8?0xef657e:0x5fcaf1,1);g.fillTriangle(x,y-s*.035,x+s*.028,y-s*(.029+.005*Math.sin(t*3+i)),x,y-s*.018);}
  }
}
