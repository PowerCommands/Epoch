/** Original code-native Dock sprite. Coordinates are a 256px isometric canvas.
 * Exported for asset generation; no image manipulation or runtime dependencies. */
export function drawDock(ctx: CanvasRenderingContext2D, broken = false): void {
  const poly = (p: number[][], color: string) => {
    ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();
  };
  const line = (a:number[],b:number[],color:string,width=1) => {
    ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  };
  // Open water remains transparent. Only small wakes surround the piles/boat.
  ctx.fillStyle='#508c9638';ctx.beginPath();ctx.ellipse(141,177,91,33,-.25,0,Math.PI*2);ctx.fill();
  poly([[26,103],[93,70],[147,101],[80,137]],'#b9af89');
  poly([[26,103],[80,137],[80,148],[26,115]],'#817b63');
  poly([[80,137],[147,101],[147,112],[80,148]],'#656d60');
  const pier = (x:number,y:number,length:number) => {
    poly([[x,y],[x+22,y-12],[x+22+length,y-12+length*.57],[x+length,y+length*.57]],broken?'#736455':'#ad8554');
    poly([[x+length,y+length*.57],[x+22+length,y-12+length*.57],[x+22+length,y-6+length*.57],[x+length,y+6+length*.57]],'#58483a');
    for(let d=4;d<length;d+=7)line([x+d,y+d*.57],[x+22+d,y-12+d*.57],'#705538',1);
    for(const d of [0,length*.48,length])for(const side of [0,22]){
      const px=x+d+side,py=y+d*.57-side*.55;
      ctx.fillStyle='#5a4635';ctx.fillRect(px-2,py-5,4,15);
      ctx.fillStyle='#c3a16c';ctx.beginPath();ctx.ellipse(px,py-5,2.8,1.7,0,0,Math.PI*2);ctx.fill();
      line([px-5,py+11],[px+4,py+10],'#a4d0c177');
    }
  };
  pier(58,130,93);pier(116,97,90);
  // Small stores shed, with warm plaster, timber framing and a pitched roof.
  poly([[49,94],[80,111],[111,94],[80,76]],'#8b7755');
  poly([[49,94],[80,111],[80,69],[49,52]],broken?'#847863':'#c1aa7b');
  poly([[80,111],[111,94],[111,52],[80,69]],'#8b7654');
  poly([[43,54],[76,32],[116,53],[81,76]],broken?'#60574d':'#985c40');
  poly([[43,54],[76,32],[77,46],[53,60]],'#bd8052');
  for(let i=0;i<5;i++)line([53+i*7,51-i*4],[85+i*6,68-i*3.8],'#c58d5b',.9);
  poly([[88,101],[101,94],[101,66],[88,73]],'#393a30');
  line([53,63],[53,95],'#67543c',3);line([78,76],[78,107],'#67543c',3);
  // Cargo crates and coiled rope occupy the shore end, leaving piers clear.
  for(const [x,y] of [[39,100],[111,110],[95,120]]){
    poly([[x,y],[x+10,y-5],[x+20,y],[x+10,y+6]],'#c4a16b');
    poly([[x,y],[x+10,y+6],[x+10,y+17],[x,y+11]],'#8e6b42');
    poly([[x+10,y+6],[x+20,y],[x+20,y+11],[x+10,y+17]],'#705638');
    line([x+3,y+3],[x+8,y+12],'#4c4436');
  }
  ctx.strokeStyle='#c3ad76';ctx.lineWidth=2;
  for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(79,125,8-i*2,4-i,0,0,Math.PI*2);ctx.stroke();}
  // A rowboat moored between the piers; no engine or later-era equipment.
  poly([[127,137],[149,139],[177,159],[180,174],[160,172],[134,153]],broken?'#766b56':'#b18550');
  poly([[132,141],[149,144],[171,160],[174,169],[160,166],[138,151]],'#594536');
  line([142,147],[137,151],'#caa876',3);line([153,153],[148,159],'#caa876',3);line([164,160],[159,165],'#caa876',3);
  line([144,150],[179,177],'#c4a168',2);line([148,154],[128,174],'#bfa276',2);
  line([130,142],[114,139],'#b3a77f',1);
  if(broken){poly([[173,122],[191,117],[184,132]],'#34392f');line([111,103],[132,117],'#39372d',4);}
}
