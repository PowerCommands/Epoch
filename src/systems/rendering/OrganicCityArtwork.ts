/** One continuous streetscape in tile-width units. No sector-centered districts.
 * Ground is clipped to land; roofs may overhang internal boundaries. */
export type CityPoint = { x: number; y: number };
export const CITY_STREETS: CityPoint[][] = [
  [[-1.44,.48],[-1.05,.36],[-.69,.42],[-.35,.23],[.02,.30],[.32,.13],[.74,.19],[1.40,-.03]],
  [[-.75,-1.24],[-.66,-.86],[-.40,-.57],[-.45,-.23],[-.35,.23],[-.16,.59],[-.24,.87],[.04,1.32]],
  [[-1.25,-.36],[-.87,-.29],[-.45,-.23],[.02,-.39],[.42,-.32],[.67,-.59],[.98,-.77]],
  [[.42,-.32],[.52,-.02],[.32,.13],[.40,.55],[.77,.81],[.69,1.22]],
  [[-.66,-.86],[-.13,-.91],[.17,-.73],[.62,-.84]],
  [[-1.02,.91],[-.62,.76],[-.16,.59]],
  [[.40,.55],[.92,.48],[1.25,.64]],
].map(path => path.map(([x,y]) => ({x,y})));
export const CITY_FOUNTAIN = {x:.08,y:.065};
export function cityContains(points: CityPoint[], p: CityPoint): boolean {
  let hit=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }
  return hit;
}
const segmentDistance=(p:CityPoint,a:CityPoint,b:CityPoint)=>{
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};
export function drawOrganicCity(ctx:CanvasRenderingContext2D, land:CityPoint[][], size:number):CityPoint[] {
  const smoke:CityPoint[]=[];
  const polygons=land.map(poly=>poly.map(p=>({x:p.x/size,y:p.y/size})));
  const inside=(p:CityPoint)=>polygons.some(poly=>cityContains(poly,p));
  let seed=3917;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  ctx.save();ctx.scale(size,size);
  const poly=(points:CityPoint[],color:string)=>{
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=color;ctx.fill();
  };
  const line=(points:CityPoint[],width:number,color:string)=>{
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineWidth=width;ctx.strokeStyle=color;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
  };
  // An uneven envelope hides the internal grid without painting the seven-hex
  // silhouette. Small courtyards and peripheral gardens expose natural ground.
  const envelope:CityPoint[]=Array.from({length:64},(_,i)=>{
    const a=i*Math.PI/32,r=1.27+.095*Math.sin(a*3+.7)+.055*Math.cos(a*7);
    return {x:Math.cos(a)*r,y:Math.sin(a)*r};
  });
  const urban=(p:CityPoint)=>inside(p)&&cityContains(envelope,p);
  ctx.save();ctx.beginPath();
  polygons.forEach(points=>{points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();});ctx.clip();
  poly(envelope,'#829362');
  for(let i=0;i<3400;i++){
    const p={x:(random()-.5)*2.9,y:(random()-.5)*2.9};if(!urban(p))continue;
    ctx.fillStyle=random()<.5?'#9eae78':'#728656';ctx.fillRect(p.x,p.y,.013,.006);
  }
  CITY_STREETS.forEach((path,i)=>{line(path,i<2?.089:.054,'#756c55');line(path,i<2?.065:.036,'#bcac88');});
  const plaza=[{x:-.13,y:.02},{x:.18,y:-.03},{x:.32,y:.12},{x:.23,y:.30},{x:-.09,y:.32},{x:-.22,y:.19}];
  poly(plaza,'#c9bea0');
  for(let i=0;i<120;i++){
    const p={x:random()*.55-.23,y:random()*.36-.03};if(cityContains(plaza,p)){
      ctx.fillStyle='#b1a78c';ctx.fillRect(p.x,p.y,.015,.004);
    }
  }
  ctx.restore();
  type Building={x:number;y:number;w:number;d:number;h:number;angle:number;roof:string;kind:number};
  const roofs=['#984f38','#ad6244','#784a3b','#8d4f39','#596b68','#786a52','#ba7950'];
  const buildings:Building[]=[
    {x:-.12,y:-.08,w:.29,d:.16,h:.19,angle:-.12,roof:'#647872',kind:1},
    {x:.39,y:-.64,w:.20,d:.30,h:.20,angle:.19,roof:'#6d7772',kind:2},
    {x:-.84,y:-.39,w:.31,d:.17,h:.12,angle:.18,roof:'#874936',kind:3},
    {x:-1.03,y:.28,w:.24,d:.16,h:.12,angle:-.22,roof:'#84533e',kind:3},
  ];
  const footprint=(b:Building,pad=0)=>{
    const c=Math.cos(b.angle),s=Math.sin(b.angle);
    return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:b.x+x*(b.w/2+pad)*c-y*(b.d/2+pad)*s,y:b.y+(x*(b.w/2+pad)*s+y*(b.d/2+pad)*c)*.65}));
  };
  // Closely fitted blocks, sampled independently of tile centers and hex edges.
  // Stable randomness keeps the baked texture reusable between cities.
  for(let i=0;i<6500;i++){
    const x=(random()-.5)*2.8,y=(random()-.5)*2.7;
    const b:Building={x,y,w:.12+random()*.105,d:.11+random()*.09,h:.10+random()*.12,
      angle:(x<-.5?.14:x>.4?-.25:-.08)+(random()-.5)*.48,roof:roofs[Math.floor(random()*roofs.length)],kind:random()<.3?4:0};
    if(!footprint(b,.015).every(urban)||cityContains(plaza,{x,y}))continue;
    if(CITY_STREETS.some((path,j)=>path.slice(1).some((p,k)=>segmentDistance({x,y},path[k],p)<(j<2?.05:.027)+b.d*.32)))continue;
    if(buildings.some(a=>Math.abs(a.x-x)<(a.w+b.w)*.46 && Math.abs(a.y-y)<(a.d+b.d)*.30+.013))continue;
    buildings.push(b);
  }
  // Occasional garden trees along the ragged edge, never arranged by sector.
  for(let i=0;i<95;i++){
    const p={x:(random()-.5)*2.85,y:(random()-.5)*2.85};
    if(!inside(p)||cityContains(envelope,p)||random()<.4)continue;
    ctx.fillStyle='#514e38';ctx.fillRect(p.x,p.y-.045,.012,.06);
    ctx.fillStyle='#596f47';ctx.beginPath();ctx.ellipse(p.x,p.y-.064,.045,.056,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#82915a';ctx.beginPath();ctx.ellipse(p.x-.015,p.y-.079,.025,.032,0,0,Math.PI*2);ctx.fill();
  }
  buildings.filter(b=>footprint(b).every(inside)).sort((a,b)=>a.y-b.y).forEach((b,index)=>{
    const c=Math.cos(b.angle),s=Math.sin(b.angle);
    const at=(x:number,y:number,z=0)=>({x:b.x+x*c-y*s,y:b.y+(x*s+y*c)*.65-z});
    const w=b.w/2,d=b.d/2,h=b.h,r=b.w*.32;
    poly([at(-w,-d),at(w,-d),at(w+.06,d+.035),at(-w+.03,d+.035)],'#41432f55');
    poly([at(-w,d),at(w,d),at(w,d,h),at(-w,d,h)],b.kind===1?'#d0bf96':'#c8b18a');
    poly([at(w,-d),at(w,d),at(w,d,h),at(w,-d,h)],'#8e846c');
    poly([at(-w,-d,h),at(0,-d,h+r),at(w,-d,h)],'#bda783');
    poly([at(-w-.01,-d-.01,h),at(0,-d-.01,h+r),at(0,d+.012,h+r),at(-w-.01,d+.012,h)],b.roof);
    poly([at(0,-d-.01,h+r),at(w+.012,-d-.01,h),at(w+.012,d+.012,h),at(0,d+.012,h+r)],b.roof==='#647872'?'#4b605b':'#6c4435');
    line([at(0,-d-.01,h+r),at(0,d+.012,h+r)],.009,'#d0a37a');
    // Half-timber facades, multiple floors and small shopfronts.
    if(b.kind===4){
      for(const z of [.025,h*.52,h])line([at(-w,d,z),at(w,d,z)],.008,'#63503d');
      for(const x of [-w,0,w])line([at(x,d),at(x,d,h)],.007,'#63503d');
      line([at(-w,d,h*.52),at(0,d,h)],.006,'#63503d');
    }
    for(let x=-w+.025;x<w-.01;x+=.052)for(let z=.067;z<h-.01;z+=.068){
      poly([at(x,d+.002,z),at(x+.021,d+.002,z),at(x+.021,d+.002,z+.029),at(x,d+.002,z+.029)],'#454b40');
    }
    poly([at(-.018,d+.004),at(.018,d+.004),at(.018,d+.004,.053),at(-.018,d+.004,.053)],'#554b3b');
    if(b.kind===0&&b.h>.17){
      poly([at(-w,d,.059),at(w*.4,d,.059),at(w*.4,d+.055,.035),at(-w,d+.055,.035)],'#9b8051');
    }
    if(b.kind===2){
      const p=at(-.015,-d+.035,h);ctx.fillStyle='#c5bc9c';ctx.fillRect(p.x-.038,p.y-.23,.076,.24);
      ctx.fillStyle='#736f5a';ctx.fillRect(p.x+.014,p.y-.23,.024,.24);
      ctx.fillStyle='#454f46';ctx.fillRect(p.x-.024,p.y-.20,.015,.055);ctx.fillRect(p.x+.003,p.y-.20,.015,.055);
      poly([{x:p.x-.057,y:p.y-.23},{x:p.x,y:p.y-.34},{x:p.x+.054,y:p.y-.23}],'#566a62');
    }
    if((b.kind===0 || b.kind===4) && index%9===0){
      const p=at(w*.2,0,h+r*.8);
      ctx.fillStyle='#8c6852';ctx.fillRect(p.x-.010,p.y-.045,.020,.054);
      ctx.fillStyle='#d0b48c';ctx.fillRect(p.x-.014,p.y-.047,.029,.010);
      smoke.push({x:p.x*size,y:(p.y-.047)*size});
    }
    if(b.kind===3){
      const p={x:b.x+.01,y:b.y-.23};smoke.push({x:p.x*size,y:p.y*size});ctx.fillStyle='#75624c';ctx.fillRect(p.x-.013,p.y,.026,.13);
      ctx.fillStyle='#ad9776';ctx.fillRect(p.x-.02,p.y,.041,.015);
    }
  });
  // Market furniture remains small relative to the enclosing houses.
  for(let i=0;i<5;i++){
    const x=-.16+i*.081,y=i<3?.285:-.005;if(!inside({x,y}))continue;
    ctx.fillStyle='#624e36';ctx.fillRect(x,y-.025,.06,.035);
    poly([{x:x-.008,y:y-.065},{x:x+.062,y:y-.065},{x:x+.07,y:y-.025},{x:x-.015,y:y-.025}],i%2?'#a14e38':'#b49c5e');
    ctx.fillStyle='#e1c99a';ctx.fillRect(x+.018,y-.062,.013,.034);
  }
  const f=CITY_FOUNTAIN;
  ctx.fillStyle='#756f5c';ctx.beginPath();ctx.ellipse(f.x,f.y,.052,.028,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#65aaa7';ctx.beginPath();ctx.ellipse(f.x,f.y-.006,.04,.019,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#d4c6a1';ctx.fillRect(f.x-.009,f.y-.061,.018,.052);
  ctx.restore();
  return smoke;
}
