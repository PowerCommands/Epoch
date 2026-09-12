/** Four independent legs in the polar bear artwork. Opposing strides make
 * progress through the walking cycle without translating the animal. */
export const POLAR_BEAR_WALK_PERIOD = 1.65;
const LEGS = [
  { root:[.26,.51], paw:[.14,.71], phase:Math.PI, width:.09 },
  { root:[.32,.51], paw:[.36,.73], phase:0, width:.085 },
  { root:[.55,.51], paw:[.55,.71], phase:0, width:.07 },
  { root:[.65,.50], paw:[.79,.73], phase:Math.PI, width:.105 },
];
export function polarBearWalkOffset(u:number,v:number,t:number,seed:number): [number,number] {
  const phase=t*Math.PI*2/POLAR_BEAR_WALK_PERIOD+seed*Math.PI*2;
  let dx=0,dy=.004*Math.cos(phase*2);
  for(const leg of LEGS) {
    const q=Math.max(0,Math.min(1,(v-leg.root[1])/(leg.paw[1]-leg.root[1])));
    const center=leg.root[0]+(leg.paw[0]-leg.root[0])*q;
    const distance=Math.abs(u-center)/leg.width;
    if(distance>=1) continue;
    const weight=(1-distance*distance)**2*q*q*(3-2*q);
    const step=phase+leg.phase;
    dx+=.055*Math.sin(step)*weight;
    dy-=.026*Math.max(0,Math.cos(step))*weight;
  }
  const head=Math.max(0,1-((u-.85)/.15)**2-((v-.43)/.12)**2);
  dy+=head*.006*Math.sin(phase);
  return [dx,dy];
}
