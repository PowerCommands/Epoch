export type ResourceAnimal = 'cattle' | 'deer' | 'crabs' | 'sheep';
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
  if(kind==='cattle') {
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
