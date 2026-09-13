/** Reusable waterfront sectors in projected hex coordinates. Drawing never writes
 * map state; open water is deliberately left transparent. */
export type UrbanPoint = { x: number; y: number };
export interface WaterfrontSector {
  center: UrbanPoint;
  outline: UrbanPoint[];
  role: string | null;
}
export function waterfrontPoint(sector: WaterfrontSector, t: number, side = 0): UrbanPoint {
  const p = sector.center, length = Math.hypot(p.x, p.y);
  // Offset shore approaches and a dogleg prevent adjacent piers from reading
  // as spokes. Workers, cargo, boats and light effects share this geometry.
  const handedness = sector.role === 'harbor' ? -1 : 1;
  const bend = length * handedness * (.10 + Math.max(0, t - .70) * .25);
  return { x: p.x * t - p.y / length * (side + bend), y: p.y * t + p.x / length * (side + bend) };
}
export function lighthouseLight(sector: WaterfrontSector, size: number): UrbanPoint {
  const p = waterfrontPoint(sector, 1.03);
  return { x: p.x, y: p.y - size * .29 };
}

/** Shared land/water edges form one continuous shore, including adjacent
 * districts. Only the narrow quay occupies the edge, never the water surface. */
export function drawUrbanShore(
  ctx: CanvasRenderingContext2D, water: WaterfrontSector[], land: UrbanPoint[][], size: number,
): void {
  const same = (a: UrbanPoint, b: UrbanPoint) => Math.hypot(a.x-b.x, a.y-b.y) < .1;
  for (const sector of water) for (let i=0; i<sector.outline.length; i++) {
    const a=sector.outline[i], b=sector.outline[(i+1)%sector.outline.length];
    if (!land.some(poly => poly.some((p,j) => same(p,b) && same(poly[(j+1)%poly.length],a)))) continue;
    ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
    ctx.strokeStyle='#605c4c';ctx.lineWidth=size*.055;ctx.stroke();
    ctx.strokeStyle='#b6aa89';ctx.lineWidth=size*.027;ctx.stroke();
  }
}

export function drawWaterfrontSector(ctx: CanvasRenderingContext2D, sector: WaterfrontSector, size: number): void {
  const at=(t:number,side=0)=>waterfrontPoint(sector,t,side);
  const stroke=(a:UrbanPoint,b:UrbanPoint,width:number,color:string)=>{
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineWidth=width;
    ctx.strokeStyle=color;ctx.lineCap='butt';ctx.stroke();
  };
  const harbor=sector.role==='harbor', lighthouse=sector.role==='lighthouse';
  const pierWidth=size*(harbor ? .15 : lighthouse ? .06 : .095);
  // A bent timber landing joins the quay independently of the inland streets.
  for (const [a,b] of [[.39,.70],[.70,1.15]]) {
    stroke(at(a),at(b),pierWidth+size*.025,'#65523e');
    stroke(at(a),at(b),pierWidth,'#b49764');
  }
  for(let t=.44;t<1.16;t+=.065)stroke(at(t,-pierWidth/2),at(t,pierWidth/2),.8,'#735b3f');
  const fingers=lighthouse?[1.05]:harbor?[.65,.88,1.12]:[.72,1.08];
  for(const t of fingers){
    const end=at(t,size*(harbor ? .34 : lighthouse ? .13 : .26));
    stroke(at(t),end,size*(harbor ? .09 : .065),'#a98b5b');
    ctx.fillStyle='#554735';ctx.fillRect(end.x-1,end.y-2,2,6);
    ctx.fillStyle='#d4b981';ctx.fillRect(end.x-1,end.y-3,2,1.5);
  }
  const warehouse=(t:number,side:number,w:number)=>{
    const p=at(t,side),h=w*.65;
    ctx.fillStyle='#82745b';ctx.fillRect(p.x-w/2,p.y-h,w,h);
    ctx.fillStyle='#c3ac83';ctx.fillRect(p.x-w/2,p.y-h,w*.72,h);
    ctx.fillStyle='#8e523c';ctx.beginPath();ctx.moveTo(p.x-w*.58,p.y-h);
    ctx.lineTo(p.x-w*.05,p.y-h-w*.36);ctx.lineTo(p.x+w*.57,p.y-h);ctx.fill();
    ctx.fillStyle='#4b4536';ctx.fillRect(p.x-w*.12,p.y-h*.55,w*.24,h*.55);
    ctx.fillStyle='#d6b967';ctx.fillRect(p.x-w*.36,p.y-h*.74,w*.12,h*.2);
  };
  // Shore buildings remain at the landward end; warehouses do not blanket water.
  if(!lighthouse)warehouse(.46,0,size*(harbor ? .21 : .14));
  if(harbor)warehouse(.48,-size*.19,size*.15);
  const boat=(t:number,side:number,large=false)=>{
    const p=at(t,side),angle=Math.atan2(sector.center.y,sector.center.x);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
    const length=size*(large ? .16 : .10);
    ctx.fillStyle='#5e4834';ctx.beginPath();ctx.ellipse(0,0,length,size*(large ? .044 : .03),0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ba9865';ctx.fillRect(-length*.6,-size*.019,length*1.15,size*.038);
    ctx.strokeStyle='#665440';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-size*.06);ctx.lineTo(0,size*.04);ctx.stroke();
    ctx.restore();
  };
  if(!lighthouse)boat(.91,size*.20,harbor);
  if(harbor){
    boat(.71,-size*.20,true);
    stroke(at(.72,-size*.32),at(1.24,-size*.32),size*.05,'#999681');
    // Timber treadwheel crane, appropriate to a medieval commercial quay.
    const c=at(.87,size*.27);
    stroke(c,{x:c.x,y:c.y-size*.20},size*.024,'#6b5035');
    stroke({x:c.x-size*.04,y:c.y-size*.19},{x:c.x+size*.13,y:c.y-size*.25},size*.022,'#9e794b');
    stroke({x:c.x+size*.13,y:c.y-size*.25},{x:c.x+size*.13,y:c.y-size*.07},.7,'#514a3a');
    ctx.strokeStyle='#684f36';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(c.x-size*.04,c.y-size*.07,size*.055,0,Math.PI*2);ctx.stroke();
  }
  if(lighthouse){
    const p=at(1.03);
    ctx.fillStyle='#8c9183';ctx.beginPath();ctx.ellipse(p.x,p.y,size*.09,size*.055,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d9cbaa';ctx.fillRect(p.x-size*.035,p.y-size*.27,size*.07,size*.27);
    ctx.fillStyle='#a49d87';ctx.fillRect(p.x+size*.012,p.y-size*.27,size*.024,size*.27);
    ctx.fillStyle='#514b3d';ctx.fillRect(p.x-size*.012,p.y-size*.08,size*.024,size*.065);
    ctx.fillStyle='#eed68c';ctx.fillRect(p.x-size*.027,p.y-size*.32,size*.054,size*.052);
    ctx.fillStyle='#647269';ctx.beginPath();ctx.moveTo(p.x-size*.065,p.y-size*.32);ctx.lineTo(p.x,p.y-size*.39);ctx.lineTo(p.x+size*.065,p.y-size*.32);ctx.fill();
  } else for(let i=0;i<(harbor?7:3);i++){
    const p=at(.58+(i%3)*.12,(i%2?1:-1)*size*.035);
    ctx.fillStyle=i%2?'#b69b65':'#826543';ctx.fillRect(p.x,p.y-size*.028,size*.028,size*.028);
    ctx.strokeStyle='#584a37';ctx.lineWidth=.5;ctx.strokeRect(p.x,p.y-size*.028,size*.028,size*.028);
  }
}
