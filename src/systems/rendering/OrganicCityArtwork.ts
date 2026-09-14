/** One continuous streetscape in tile-width units. No sector-centered districts.
 * Ground is clipped to land; roofs may overhang internal boundaries. */
export type CityPoint = { x: number; y: number };
export interface CityArtwork {
  smoke: CityPoint[];
  engines: CityPoint[];
  occluders: CityOccluder[];
}
export interface CityOccluder {
  points: CityPoint[];
  left: number; right: number; top: number; bottom: number;
}
export function cityOccluded(p: CityPoint, occluders: CityOccluder[]): boolean {
  return occluders.some(o=>p.x>=o.left && p.x<=o.right && p.y>=o.top && p.y<=o.bottom && cityContains(o.points,p));
}
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
/** Find the continuous foreground rail corridor on land, including coastal shells. */
export function cityRailCorridor(land: CityPoint[][], size: number) {
  // Adjacent hex edges can differ by floating-point roundoff after projection.
  // Do not split a continuous railway at a sub-pixel crack between land tiles.
  const onLand=(p:CityPoint)=>land.some(poly=>cityContains(poly,p)
    || cityContains(poly,{x:p.x+size*1e-7,y:p.y}) || cityContains(poly,{x:p.x-size*1e-7,y:p.y}));
  const atHeight = (height: number) => {
    const y = height * size;
    let start = 0, bestStart = 0, bestEnd = 0, running = false;
    for (let i = 0; i <= 280; i++) {
      const x = (i / 100 - 1.4) * size;
      const inside = onLand({x,y:y-.04*size}) && onLand({x,y:y+.04*size});
      if (inside && !running) { start = x; running = true; }
      if ((!inside || i === 280) && running) {
        const end = x - .01 * size;
        if (end - start > bestEnd - bestStart) { bestStart = start; bestEnd = end; }
        running = false;
      }
    }
    return {left:bestStart, right:bestEnd, y};
  };
  const foreground = atHeight(.62);
  // Southern waterfronts can replace both foreground land sectors. Move the
  // same rail corridor onto the central land tile, never across open water.
  return foreground.right-foreground.left >= size*.6 ? foreground : atHeight(.28);
}

/** Baked material detail costs nothing in the animation loop. All positions and
 * factory outlets are deterministic, including when a coastal texture is reused. */
export function drawOrganicCity(ctx: CanvasRenderingContext2D, land: CityPoint[][], size: number, industrial = false): CityArtwork {
  const smoke: CityPoint[] = [], engines: CityPoint[] = [];
  const occluders: CityOccluder[] = [];
  const polygons = land.map(poly => poly.map(p => ({x:p.x/size, y:p.y/size})));
  const inside = (p: CityPoint) => polygons.some(poly => cityContains(poly, p));
  let seed = 3917;
  const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  ctx.save(); ctx.scale(size, size);
  const poly = (points: CityPoint[], color: string) => {
    ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };
  const line = (points: CityPoint[], width: number, color: string) => {
    ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
    ctx.lineWidth=width; ctx.strokeStyle=color; ctx.lineJoin='round'; ctx.lineCap='butt'; ctx.stroke();
  };
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string) => {
    ctx.fillStyle=color; ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill();
  };
  const envelope = Array.from({length:64}, (_,i) => {
    const a=i*Math.PI/32, r=1.27+.095*Math.sin(a*3+.7)+.055*Math.cos(a*7);
    return {x:Math.cos(a)*r, y:Math.sin(a)*r};
  });
  const urban = (p: CityPoint) => inside(p) && cityContains(envelope,p);
  const plaza = (industrial
    ? [[-.36,-.01],[.22,-.04],[.32,.12],[.23,.30],[-.28,.32],[-.40,.19]]
    : [[-.38,-.02],[.20,-.07],[.39,.11],[.25,.37],[-.29,.37],[-.43,.19]])
    .map(([x,y]) => ({x,y}));
  const rail = cityRailCorridor(land,size);
  ctx.save(); ctx.beginPath();
  polygons.forEach(points => { points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath(); }); ctx.clip();
  poly(envelope, industrial ? '#626b60' : '#4e803c');
  for (let i=0; i<4000; i++) {
    const p={x:(random()-.5)*2.9,y:(random()-.5)*2.9}; if (!urban(p)) continue;
    ctx.fillStyle=industrial ? ['#46534c','#79796a','#9a9278'][i%3] : ['#699646','#387044','#80a851'][i%3];
    ctx.fillRect(p.x,p.y,.010+random()*.014,.004);
  }
  CITY_STREETS.forEach((path,i) => {
    const width=i<2?.092:.06;
    line(path,width+.022,industrial?'#3b413a':'#38532e');
    line(path,width+.009,industrial?'#a1a092':'#a79f7e');
    line(path,width,industrial?'#697577':'#a8a58c');
    // Laid cobbles follow the same bends as walkers and horse teams.
    for (let j=1; j<path.length; j++) {
      const a=path[j-1],b=path[j],length=Math.hypot(b.x-a.x,b.y-a.y),dx=(b.x-a.x)/length,dy=(b.y-a.y)/length;
      for (let d=0; d<length; d+=.017) for (const side of [-.027,0,.027]) {
        const t=d+(side===0?.008:0),x=a.x+dx*t-dy*side,y=a.y+dy*t+dx*side;
        line([{x:x-dx*.005,y:y-dy*.005},{x:x+dx*.005,y:y+dy*.005}],.009,
          industrial ? (random()<.5?'#87918c':'#526166') : (random()<.5?'#c6c4aa':'#858b7a'));
      }
    }
    line(path,.007,industrial?'#394b4c88':'#706d4866');
  });
  poly(plaza,industrial?'#7e8780':'#bab8a0');
  for (let y=-.05,row=0; y<.38; y+=.024,row++) for (let x=-.43+(row%2)*.018; x<.39; x+=.037) {
    if (!cityContains(plaza,{x,y})) continue;
    ctx.fillStyle=industrial ? ['#969d90','#596b6d','#788781'][Math.floor(random()*3)] : ['#d5cfb6','#9b9f8b','#c6c6ad'][Math.floor(random()*3)];
    ctx.fillRect(x,y,.030,.016);
  }
  if (industrial) for (let i=0; i<36; i++) {
    const x=(random()-.5)*2.3,y=(random()-.5)*2.2;
    if (urban({x,y})) ellipse(x,y,.014+random()*.042,.008,'#253c3d55');
  }
  ctx.restore();

  type Building = {x:number;y:number;w:number;d:number;h:number;angle:number;roof:number;kind:number};
  const buildings: Building[] = industrial ? [
    {x:-.04,y:-.12,w:.43,d:.23,h:.23,angle:0,roof:0,kind:3},
    {x:.40,y:-.68,w:.30,d:.24,h:.38,angle:.12,roof:1,kind:2},
    {x:-.82,y:.94,w:.37,d:.22,h:.23,angle:.1,roof:0,kind:3},
    {x:-.88,y:-.42,w:.38,d:.23,h:.22,angle:.10,roof:1,kind:3},
  ] : [
    {x:-.12,y:-.24,w:.35,d:.21,h:.19,angle:-.08,roof:3,kind:1},
    {x:.39,y:-.64,w:.21,d:.29,h:.19,angle:.16,roof:3,kind:2},
    {x:-.84,y:-.40,w:.30,d:.20,h:.13,angle:.14,roof:0,kind:3},
  ];
  const footprint = (b: Building, pad=0) => {
    const c=Math.cos(b.angle),s=Math.sin(b.angle);
    return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y]) => {
      const u=x*(b.w/2+pad)*c-y*(b.d/2+pad)*s,v=x*(b.w/2+pad)*s+y*(b.d/2+pad)*c;
      return {x:b.x+u-v*.38,y:b.y+u*.18+v*.60};
    });
  };
  for (let i=0; i<(industrial?7000:1900); i++) {
    const x=(random()-.5)*2.8,y=(random()-.5)*2.7;
    const b: Building={x,y,w:.145+random()*(industrial?.12:.105),d:.13+random()*.08,
      h:(industrial?.22:.105)+random()*(industrial?.14:.075),
      angle:(x<-.5?.16:x>.4?-.20:-.08)+(random()-.5)*.30,roof:Math.floor(random()*5),kind:!industrial&&random()<.65?4:0};
    if (industrial && Math.abs(y-rail.y/size)<b.d*.4+.095 && x>rail.left/size-.1 && x<rail.right/size+.1) continue;
    if (!footprint(b,industrial?.01:.037).every(urban) || footprint(b,.025).some(p=>cityContains(plaza,p))) continue;
    if (CITY_STREETS.some((path,j) => path.slice(1).some((p,k) => segmentDistance({x,y},path[k],p)<(j<2?.067:.049)+b.d*.36))) continue;
    // Town keeps kitchen gardens and working yards; City infills those spaces.
    if (buildings.some(a => Math.abs(a.x-x)<(a.w+b.w)*.5+(industrial?.005:.041)
      && Math.abs(a.y-y)<(a.d+b.d)*.33+(industrial?.012:.059))) continue;
    buildings.push(b);
  }
  const visibleBuildings=buildings.filter(b=>footprint(b).every(inside)).sort((a,b)=>a.y-b.y);
  // Cast shadows, yards and gardens go below every building, keeping their
  // direction consistent rather than stamping shadows across nearby roofs.
  for (const b of visibleBuildings) {
    const ground=footprint(b);
    poly([ground[0],ground[1],{x:ground[2].x+b.h*.43,y:ground[2].y+b.h*.23},
      {x:ground[3].x+b.h*.43,y:ground[3].y+b.h*.23},ground[3]],'#14282c55');
    if (!industrial && b.kind===4) {
      const p={x:b.x-.06,y:b.y+.12};
      if (urban(p) && !cityContains(plaza,p) && !CITY_STREETS.some(path=>path.slice(1).some((q,k)=>segmentDistance(p,path[k],q)<.08))) {
        ctx.fillStyle='#554a2f'; ctx.fillRect(p.x-.06,p.y,.12,.055);
        for(let row=0;row<3;row++) line([{x:p.x-.054,y:p.y+.01+row*.018},{x:p.x+.05,y:p.y+.01+row*.018}],.008,row%2?'#589146':'#7ea143');
        line([{x:p.x-.064,y:p.y-.006},{x:p.x+.06,y:p.y-.006}],.005,'#bda36a');
      }
    }
  }
  const townRoofs=[['#c2532d','#753420','#ed8c49'],['#b43b2a','#642f27','#dc6c42'],['#a86632','#673e26','#e3a05a'],['#356a70','#243e4e','#71a3a1'],['#934030','#542d29','#c87549']];
  const cityRoofs=[['#344c5c','#1e303f','#778b91'],['#416274','#243c4c','#92a4a6'],['#744638','#472d2b','#b67d54'],['#2e535c','#203b42','#678c8d'],['#535760','#303846','#92989d']];
  for (const [index,b] of visibleBuildings.entries()) {
    const c=Math.cos(b.angle),s=Math.sin(b.angle);
    const at=(x:number,y:number,z=0)=>{
      const u=x*c-y*s,v=x*s+y*c;
      return {x:b.x+u-v*.38,y:b.y+u*.18+v*.60-z};
    };
    const w=b.w/2,d=b.d/2,h=b.h,r=b.w*(industrial?.24:.38);
    // Street traffic behind a baked roof is hidden, rather than painted over it.
    const silhouette=[at(-w,-d,h),at(0,-d,h+r),at(w,-d,h),at(w,-d),at(w,d),at(-w,d),at(-w,d,h)]
      .map(p=>({x:p.x*size,y:p.y*size}));
    occluders.push({points:silhouette,left:Math.min(...silhouette.map(p=>p.x)),right:Math.max(...silhouette.map(p=>p.x)),
      top:Math.min(...silhouette.map(p=>p.y)),bottom:Math.max(...silhouette.map(p=>p.y))});
    const face=(x:number,z:number,ww:number,hh:number,color:string)=>poly([at(x,d,z),at(x+ww,d,z),at(x+ww,d,z+hh),at(x,d,z+hh)],color);
    const wall=industrial ? ['#b75936','#cb754a','#9e4936','#ac6945','#bec0a6'][index%5] : ['#eedbb1','#d6e2c5','#f2e4c7','#ce9b69','#ded3ae'][index%5];
    poly([at(-w,d),at(w,d),at(w,d,h),at(-w,d,h)],wall);
    poly([at(w,-d),at(w,d),at(w,d,h),at(w,-d,h)],industrial?'#743d32':'#88896d');
    const weather=ctx.createLinearGradient(b.x,b.y-h,b.x,b.y);
    weather.addColorStop(0,'#182b3338');weather.addColorStop(.23,'#fff5d209');weather.addColorStop(.70,'#233c3500');weather.addColorStop(1,industrial?'#172e3b70':'#354f433a');
    ctx.fillStyle=weather;ctx.beginPath();[at(-w,d),at(w,d),at(w,d,h),at(-w,d,h)].forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
    for(let j=0;j<(industrial?24:10);j++) {
      const x=-w+random()*b.w,z=.025+random()*(h-.04);
      face(x,z,Math.min(.008+random()*.015,w-x),.004+random()*.01,industrial?(j%2?'#3c3e352b':'#f8c08030'):'#88735322');
    }
    face(-w,0,b.w,.021,industrial?'#3e4742':'#71786a');
    // Fine masonry, staggered joints and dark water staining under the eaves.
    for(let z=.025,row=0;z<h;z+=industrial?.022:.042,row++) {
      line([at(-w,d,z),at(w,d,z)],industrial?.0024:.002,industrial?'#e69c6959':'#8d826e48');
      for(let x=-w+(row%2)*.023;x<w;x+=.047) line([at(x,d,z),at(x,d,Math.min(h,z+.018))],.0018,industrial?'#612e2b55':'#8d826e40');
    }
    face(-w,h-.021,b.w,.021,'#202e2a55');
    for (const x of [-w+.009,w-.012]) line([at(x,d,.02),at(x,d,h-.012)],.009,industrial?'#d09262':'#faf0d1');
    if (b.kind===4 || (!industrial && b.kind===1)) {
      const timber='#493526';
      for(const z of [.027,h*.53,h-.008]) line([at(-w,d,z),at(w,d,z)],.009,timber);
      for(const x of [-w+.005,0,w-.005]) line([at(x,d),at(x,d,h)],.008,timber);
      for(const side of [-1,1]) line([at(side*w,d,h*.55),at(0,d,h-.006)],.006,timber);
      line([at(w,-d,h*.53),at(w,d,h*.53)],.007,timber);
      line([at(w,0),at(w,0,h)],.007,timber);
    }
    // Recessed blue-black glass, lit reveals, sills and occasional shutters.
    for(let x=-w+.026,col=0;x<w-.026;x+=.054,col++) for(let z=.060;z<h-.023;z+=.066) {
      face(x-.004,z-.003,.030,.039,industrial?'#e0a476':'#faf0cb');
      face(x,z,.020,.030,'#172f39');
      face(x+.002,z+.017,.013,.009,index%7===0?'#e7aa4b':'#679499');
      line([at(x+.010,d,z),at(x+.010,d,z+.03)],.0025,'#bdc7b0');
      line([at(x-.005,d,z-.005),at(x+.028,d,z-.005)],.004,'#f0d5a1');
      if(!industrial && col%2===0) for(const side of [-.011,.025]) face(x+side,z,.008,.031,index%2?'#285e58':'#96402c');
    }
    for(let y=-d+.024;y<d-.02;y+=.06) for(let z=.066;z<h-.02;z+=.066) {
      poly([at(w,y,z),at(w,y+.021,z),at(w,y+.021,z+.029),at(w,y,z+.029)],'#192f32');
      line([at(w,y,z+.030),at(w,y+.023,z+.030)],.003,'#b79c78');
    }
    face(-.022,0,.044,.056,'#332d26'); face(-.016,.003,.030,.049,industrial?'#394e4a':'#75472b');
    line([at(-.018,d,.005),at(.020,d,.005)],.006,'#d4c4a2');
    if(b.kind===3 && industrial) {
      face(-w+.024,.02,.083,.097,'#273b3b');
      for(let x=-w+.03;x<-w+.10;x+=.018) line([at(x,d,.02),at(x,d,.112)],.004,'#698278');
      face(-w+.030,.045,.022,.015,'#e07b2e');
    }
    const roof=(industrial?cityRoofs:townRoofs)[b.roof];
    poly([at(-w,-d,h),at(0,-d,h+r),at(w,-d,h)],wall);
    poly([at(-w,d,h),at(0,d,h+r),at(w,d,h)],wall);
    if(!industrial && b.kind===4) {
      line([at(-w,d,h),at(w,d,h)],.008,'#493526');
      line([at(0,d,h),at(0,d,h+r)],.007,'#493526');
      for(const side of [-1,1])line([at(side*w*.5,d,h),at(0,d,h+r*.85)],.005,'#493526');
    } else {
      face(-.011,h+r*.18,.023,r*.33,'#203842');
      line([at(-.013,d,h+r*.16),at(.014,d,h+r*.16)],.004,'#d7bb8e');
    }
    poly([at(-w-.012,-d-.018,h),at(0,-d-.018,h+r),at(0,d+.023,h+r),at(-w-.012,d+.023,h)],roof[0]);
    poly([at(0,-d-.018,h+r),at(w+.015,-d-.018,h),at(w+.015,d+.023,h),at(0,d+.023,h+r)],roof[1]);
    // Roof courses and narrow highlights describe material at map zoom.
    for(let t=.18;t<1;t+=industrial?.18:.16) {
      line([at(-w*t,-d-.018,h+r*(1-t)),at(-w*t,d+.023,h+r*(1-t))],.0025,roof[2]+'88');
      line([at(w*t,-d-.018,h+r*(1-t)),at(w*t,d+.023,h+r*(1-t))],.002,roof[2]+'40');
    }
    for(let y=-d;y<d;y+=.032) line([at(-w,y,h+.002),at(0,y,h+r+.002)],.0015,roof[2]+'45');
    const patina=ctx.createLinearGradient(b.x-w,b.y-h-r,b.x+w,b.y-h);
    patina.addColorStop(0,'#f7bc6b1c');patina.addColorStop(.5,'#141f3200');patina.addColorStop(1,'#142c3545');
    ctx.fillStyle=patina;ctx.beginPath();[at(-w-.012,-d-.018,h),at(0,-d-.018,h+r),at(0,d+.023,h+r),at(-w-.012,d+.023,h)].forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
    line([at(0,-d-.022,h+r),at(0,d+.027,h+r)],.007,roof[2]);
    line([at(-w-.013,d+.025,h),at(0,d+.025,h+r),at(w+.016,d+.025,h)],.005,industrial?'#a6ac9c':'#efc78b');
    line([at(w+.016,-d-.018,h),at(w+.016,d+.025,h)],.009,'#182f32aa');
    if(!industrial && (index%4===0 || b.kind===1)) {
      const awning=['#b83a2c','#226d70','#c28e29'][index%3];
      poly([at(-w,d,.060),at(w*.7,d,.060),at(w*.7,d+.060,.039),at(-w,d+.060,.039)],awning);
      for(let x=-w+.020;x<w*.7;x+=.040) poly([at(x,d,.061),at(x+.016,d,.061),at(x+.016,d+.06,.040),at(x,d+.06,.040)],'#f6dfb1');
      line([at(-w,d+.06,.037),at(w*.7,d+.06,.037)],.008,awning);
      const sign=at(w+.021,d,.076);
      line([sign,{x:sign.x+.045,y:sign.y}],.005,'#342e25');
      ctx.fillStyle='#a67a36';ctx.fillRect(sign.x+.020,sign.y,.031,.029);
      ctx.fillStyle='#f7d97f';ctx.fillRect(sign.x+.027,sign.y+.006,.015,.014);
    }
    if(b.kind===2) {
      const p=at(-.015,-d+.045,h);
      ctx.fillStyle=industrial?'#b8784d':'#e5d5ac';ctx.fillRect(p.x-.039,p.y-.23,.078,.24);
      ctx.fillStyle=industrial?'#713b30':'#888c74';ctx.fillRect(p.x+.016,p.y-.23,.023,.24);
      ctx.fillStyle='#203b41';ctx.fillRect(p.x-.026,p.y-.197,.019,.05);ctx.fillRect(p.x+.003,p.y-.197,.019,.05);
      line([{x:p.x-.044,y:p.y-.23},{x:p.x+.044,y:p.y-.23}],.010,'#e4c395');
      poly([{x:p.x-.058,y:p.y-.235},{x:p.x,y:p.y-.345},{x:p.x+.055,y:p.y-.235}],'#29545f');
      line([{x:p.x-.058,y:p.y-.235},{x:p.x,y:p.y-.345}],.006,'#82b2ad');
      ellipse(p.x-.002,p.y-.107,.022,.024,'#ecd8a0');
      line([{x:p.x-.002,y:p.y-.124},{x:p.x-.002,y:p.y-.107},{x:p.x+.012,y:p.y-.102}],.003,'#283d3c');
    }
    if(index%3===0 || b.kind===3) {
      const p=at(w*.38,-d*.25,h+r*.7),height=b.kind===3&&industrial?.24:.065,width=b.kind===3&&industrial?.032:.023;
      ctx.fillStyle=industrial?'#954b33':'#ab6240';ctx.fillRect(p.x-width/2,p.y-height,width,height+.015);
      ctx.fillStyle='#512f2a';ctx.fillRect(p.x+width*.12,p.y-height,width*.38,height+.015);
      for(let y=p.y-height+.023;y<p.y;y+=.025) line([{x:p.x-width/2,y},{x:p.x+width/2,y}],.003,'#d39665');
      ctx.fillStyle='#b58f6b';ctx.fillRect(p.x-width*.7,p.y-height-.006,width*1.4,.012);
      ctx.fillStyle='#233333';ctx.fillRect(p.x-width*.45,p.y-height-.007,width*.9,.005);
      // Several still wisps keep chimneys legible with reduced motion enabled.
      for(let j=0;j<3;j++) ellipse(p.x+j*.009,p.y-height-.02-j*.028,.012+j*.006,.016+j*.005,industrial?'#35404420':'#e2e8df28');
      if(index%2===0 || b.kind===3) smoke.push({x:p.x*size,y:(p.y-height-.008)*size});
    }
    if(b.kind===3 && industrial) {
      const e={x:b.x-.17,y:b.y+.18};
      // Keep the complete works on land, including its coal heap and belt.
      const yard=[[-.11,0],[.32,0],[-.11,-.15],[.32,-.15]].map(([x,y])=>({x:e.x+x,y:e.y+y}));
      const wheel={x:e.x+.075,y:e.y-.063};
      const blocksStreet=CITY_STREETS.some(path=>path.slice(1).some((p,k)=>segmentDistance(wheel,path[k],p)<.13));
      if(yard.every(inside) && !blocksStreet) {
        engines.push({x:e.x*size,y:e.y*size});
        poly([{x:e.x-.13,y:e.y+.013},{x:e.x+.30,y:e.y+.013},{x:e.x+.33,y:e.y-.025},{x:e.x-.10,y:e.y-.05}],'#444e48');
        ellipse(e.x+.30,e.y-.016,.062,.025,'#1e292b');
        for(let i=0;i<22;i++) {
          const x=e.x+.26+random()*.075,y=e.y-.028+random()*.025;
          poly([{x,y},{x:x+.009,y:y-.013},{x:x+.020,y:y+.004}],i%3?'#303c42':'#637077');
        }
      }
    }
  }
  // Small trees break up the Town's working yards and irregular outskirts.
  for(let i=0;i<(industrial?26:100);i++) {
    const p={x:(random()-.5)*2.85,y:(random()-.5)*2.85};
    if(!inside(p) || (cityContains(envelope,p) && (industrial || buildings.some(b=>Math.abs(b.x-p.x)<b.w*.65+.045&&Math.abs(b.y-p.y)<b.d*.5+.11)))) continue;
    if(cityOccluded({x:p.x*size,y:(p.y-.075)*size},occluders))continue;
    if(cityContains(plaza,p) || CITY_STREETS.some(path=>path.slice(1).some((q,k)=>segmentDistance(p,path[k],q)<.075))) continue;
    ellipse(p.x+.014,p.y+.015,.049,.020,'#163b3555');
    ctx.fillStyle='#625236';ctx.fillRect(p.x-.005,p.y-.065,.010,.08);
    ellipse(p.x,p.y-.066,.041,.050,'#285b3e');
    for(let j=0;j<11;j++) {
      const a=j*2.4,r=.025*Math.sqrt(random()),x=p.x+Math.cos(a)*r,y=p.y-.073+Math.sin(a)*r;
      ellipse(x,y,.018+random()*.010,.021+random()*.01,['#376d3b','#548541','#709b47'][j%3]);
    }
  }
  // A spacious market: striped canvas, produce, barrels, stacked trade goods.
  for(let i=0;i<(industrial?2:7);i++) {
    const x=i<4?-.29+i*.155:.27,y=i<4?.325:-.01+(i-4)*.106;
    if(!inside({x,y})) continue;
    ctx.fillStyle='#553c27';ctx.fillRect(x-.035,y-.026,.087,.045);
    for(const dx of [-.036,.052]) {ctx.fillStyle='#6b4b2b';ctx.fillRect(x+dx,y-.080,.005,.086);}
    const color=['#b33427','#1e737a','#ca9029'][i%3];
    poly([{x:x-.043,y:y-.086},{x:x+.061,y:y-.086},{x:x+.072,y:y-.040},{x:x-.054,y:y-.040}],color);
    for(let k=0;k<3;k++) poly([{x:x-.03+k*.032,y:y-.086},{x:x-.016+k*.032,y:y-.086},{x:x-.008+k*.034,y:y-.04},{x:x-.024+k*.034,y:y-.04}],'#f3e0b6');
    line([{x:x-.054,y:y-.04},{x:x+.072,y:y-.04}],.007,color);
    for(let k=0;k<5;k++) ellipse(x-.027+k*.016,y-.026,.006,.005,i%2?'#d99024':'#91b14d');
    ellipse(x+.075,y+.010,.017,.010,'#4f3826');ctx.fillStyle='#a56b33';ctx.fillRect(x+.059,y-.019,.032,.03);
    for(const dy of [-.014,.003]) line([{x:x+.059,y:y+dy},{x:x+.091,y:y+dy}],.004,'#3c443d');
    ellipse(x+.075,y-.019,.016,.008,'#d29f58');
  }
  if(!industrial) {
    const f=CITY_FOUNTAIN;
    ellipse(f.x+.010,f.y+.010,.066,.033,'#34483d55');ellipse(f.x,f.y,.056,.031,'#586d6d');
    ellipse(f.x,f.y-.008,.050,.026,'#e1d5b3');ellipse(f.x,f.y-.011,.040,.019,'#278b9a');
    ellipse(f.x-.01,f.y-.014,.020,.008,'#69c5c5');ctx.fillStyle='#efe0b9';ctx.fillRect(f.x-.009,f.y-.067,.018,.052);
    ellipse(f.x,f.y-.059,.023,.010,'#9aafa0');
  }
  if(industrial) {
    const left=rail.left/size,right=rail.right/size,y=rail.y/size;
    line([{x:left,y},{x:right,y}],.085,'#3b4747');
    for(let x=left+.015;x<right;x+=.028) {
      line([{x,y:y-.039},{x:x+.007,y:y+.039}],.011,'#594631');
      for(const dy of [-.026,.026]) ellipse(x+.01,y+dy,.008,.004,'#a19678');
    }
    for(const dy of [-.024,.024]) {
      line([{x:left,y:y+dy+.005},{x:right,y:y+dy+.005}],.011,'#24383e');
      line([{x:left,y:y+dy},{x:right,y:y+dy}],.006,'#acb9b3');
      line([{x:left,y:y+dy-.002},{x:right,y:y+dy-.002}],.002,'#e0ded0');
    }
    const center=(left+right)/2;
    ctx.fillStyle='#464e46';ctx.fillRect(center-.26,y-.118,.52,.070);
    ctx.fillStyle='#b4b19a';ctx.fillRect(center-.26,y-.123,.52,.01);
    for(const dx of [-.22,0,.22]) {
      line([{x:center+dx,y:y-.23},{x:center+dx,y:y-.12}],.009,'#203d3e');
      line([{x:center+dx-.04,y:y-.225},{x:center+dx,y:y-.18},{x:center+dx+.04,y:y-.225}],.005,'#375b58');
    }
    poly([{x:center-.28,y:y-.245},{x:center+.27,y:y-.245},{x:center+.30,y:y-.19},{x:center-.26,y:y-.19}],'#315d60');
    line([{x:center-.28,y:y-.245},{x:center+.27,y:y-.245}],.006,'#9cae9f');
    for(let x=center-.25;x<center+.28;x+=.040) line([{x,y:y-.241},{x:x+.021,y:y-.194}],.003,'#789388');
  }
  ctx.restore();
  return {smoke,engines,occluders};
}
