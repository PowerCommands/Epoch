export type ResourceAnimal = 'cattle' | 'deer' | 'crabs' | 'sheep' | 'horses';
const TAU=Math.PI*2;
const COW_LEGS=[[.43,.61,.82,0],[.50,.62,.91,Math.PI],[.70,.43,.61,Math.PI],[.78,.45,.66,0]];
const SHEEP_CENTERS=[[.28,.20],[.73,.20],[.28,.52],[.73,.52],[.50,.82]];
function leg(u:number,v:number,x:number,rootY:number,pawY:number,width:number,phase:number):[number,number] {
  const q=Math.max(0,Math.min(1,(v-rootY)/(pawY-rootY)));
  const d=Math.abs(u-x)/width;
  const weight=d<1?(1-d*d)**2*q:0;
  return [.028*Math.sin(phase)*weight,-.022*Math.max(0,Math.cos(phase))*weight];
}
export function resourceAnimalOffset(kind:ResourceAnimal,u:number,v:number,t:number,seed:number):[number,number] {
  const phase=t*TAU/1.6+seed*TAU;
  let dx=0,dy=0;
  if(kind==='horses') {
    const p=t*TAU/.8+seed*TAU;
    // The four painted legs have different roots and hoof positions. Follow
    // each leg's slanted centerline so its motion does not pull the belly.
    dy=-.022*(1+Math.sin(p));
    const pitch=.025*Math.cos(p);
    dx=-(v-.48)*pitch;dy+=(u-.48)*pitch;
    for(const [rootX,rootY,hoofX,hoofY,shift] of [
      [.31,.48,.24,.77,0],[.40,.51,.40,.76,.8],
      [.59,.57,.56,.94,2.5],[.66,.56,.66,.83,3.3],
    ]) {
      const q=Math.max(0,Math.min(1,(v-rootY)/(hoofY-rootY)));
      const center=rootX+(hoofX-rootX)*q;
      const d=Math.abs(u-center)/.065;
      const w=d<1?(1-d*d)**2*q:0;
      dx+=.075*Math.sin(p+shift)*w;
      dy-=.065*Math.max(0,Math.cos(p+shift))*w;
    }
    const head=Math.max(0,1-Math.hypot((u-.73)/.18,(v-.32)/.23));
    dx+=.012*Math.cos(p)*head;dy+=.018*Math.sin(p)*head;
    const tail=Math.max(0,1-Math.hypot((u-.20)/.13,(v-.44)/.23));
    dx-=.025*Math.sin(p)*tail;dy+=.022*Math.cos(p)*tail;
  } else if(kind==='cattle') {
    dx=.012*Math.sin(phase);dy=.006*Math.cos(phase*2);
    for(const [x,root,paw,shift] of COW_LEGS) {
      const d=leg(u,v,x,root,paw,.075,phase+shift);dx+=d[0];dy+=d[1];
    }
  } else if(kind==='deer') {
    const hop=Math.sin(phase/2)**2;
    dx=(.5-u)*.12+.02*Math.sin(phase/2);dy=(.5-v)*.12-.065*hop;
    const legs=Math.max(0,Math.min(1,(v-.55)/.36));
    dx+=legs*.025*Math.sin(phase)*(u<.42?-1:1);
    dy-=legs*.025*hop;
  } else if(kind==='crabs') {
    dx=(.5-u)*.08+.035*Math.sin(phase/2);
    dy=(.5-v)*.08+.004*Math.cos(phase*2);
    const edge=Math.max(0,Math.min(1,(Math.abs(u-.5)-.16)/.2));
    dx+=edge*.013*Math.sin(phase*2+v*24);
    dy+=edge*.018*Math.cos(phase*2+v*24);
  } else {
    // Five separate sheep in three rows. Each walks within its own patch.
    const centers=SHEEP_CENTERS;
    let nearest=0,distance=Infinity;
    centers.forEach(([x,y],i)=>{const d=(u-x)**2+(v-y)**2;if(d<distance){distance=d;nearest=i;}});
    const [cx,cy]=centers[nearest],p=phase+nearest*1.3;
    dx=.025*Math.sin(p/3);dy=.003*Math.cos(p*2);
    const legs=Math.max(0,Math.min(1,(v-cy-.045)/.075));
    dx+=legs*.009*Math.sin(p+(u<cx?0:Math.PI));
    dy-=legs*.007*Math.max(0,Math.cos(p+(u<cx?0:Math.PI)));
  }
  return [dx,dy];
}
