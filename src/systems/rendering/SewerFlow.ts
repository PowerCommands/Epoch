import type Phaser from 'phaser';

/** Centerlines stay inside the painted water, in original PNG coordinates. */
export const SEWER_FLOWS = [
  {from:[.706,.332],to:[.355,.507],width:.023,fall:false},
  {from:[.525,.595],to:[.742,.754],width:.061,fall:false},
  {from:[.322,.567],to:[.295,.654],width:.027,fall:true},
  {from:[.300,.660],to:[.409,.729],width:.044,fall:false},
  {from:[.529,.771],to:[.501,.837],width:.031,fall:true},
  {from:[.502,.841],to:[.591,.899],width:.041,fall:false},
  {from:[.862,.650],to:[.878,.720],width:.029,fall:true},
] as const;

export function drawSewerFlow(g:Phaser.GameObjects.Graphics,s:Phaser.GameObjects.Image,t:number,seed:number,detail:number):void {
  const m=s.getWorldTransformMatrix();
  const size=Math.min(Math.abs(s.width*m.scaleX),Math.abs(s.height*m.scaleY));
  const at=(x:number,y:number)=>m.transformPoint((x-s.originX)*s.width,(y-s.originY)*s.height);
  const alpha=s.alpha*detail;
  SEWER_FLOWS.forEach((flow,index)=>{
    const [ax,ay]=flow.from,[bx,by]=flow.to,dx=bx-ax,dy=by-ay;
    const length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;
    // A translucent stream connects each mouth to its splash throughout the loop.
    if(flow.fall) {
      const a=at(ax,ay),b=at(bx,by);
      g.lineStyle(size*flow.width,0x78b8b3,alpha*.55).lineBetween(a.x,a.y,b.x,b.y);
    }
    const count=flow.fall?6:10;
    for(let n=0;n<count;n++) {
      const q=(t/(flow.fall?.55:1.4)+seed+index*.137+n/count)%1;
      const fade=Math.sin(q*Math.PI)*alpha;
      const lane=Math.sin(n*2.4+index)*flow.width*.30;
      const x=ax+dx*q+nx*lane,y=ay+dy*q+ny*lane;
      const span=flow.width*(flow.fall?.12:.30);
      const a=at(x-nx*span,y-ny*span);
      const b=at(x+nx*span+dx*.065,y+ny*span+dy*.065);
      g.lineStyle(Math.max(.65,size*(flow.fall?.005:.004)),n%3?0xd4f4df:0x77c9c7,fade*.85);
      g.lineBetween(a.x,a.y,b.x,b.y);
    }
    if(flow.fall) for(let n=0;n<3;n++) {
      const q=(t/.65+seed+n/3)%1,p=at(bx+(n-1)*flow.width*.22,by);
      g.lineStyle(Math.max(.6,size*.003),0xe6fff1,alpha*(1-q)*.8);
      g.strokeEllipse(p.x,p.y,size*flow.width*(.4+q),size*flow.width*(.2+q*.4));
    }
  });
}
