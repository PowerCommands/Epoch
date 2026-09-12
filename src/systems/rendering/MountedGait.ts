/** Texture-space riding gait for the shared horseman/knight artwork. The
 * saddle and torso travel together; front and rear legs take opposing strides. */
export interface MountedGait {
  period: number;
  bounce: number;
  stride: number;
  legs: { root: [number, number]; hoof: [number, number]; width: number; phase: number }[];
}
export const RIDING_GAIT: MountedGait = {
  period: 1.25,
  bounce: .014,
  stride: .052,
  legs: [
    {root:[.450,.65],hoof:[.450,.91],width:.095,phase:0},
    {root:[.675,.565],hoof:[.670,.78],width:.105,phase:Math.PI},
  ],
};
const smooth = (n: number): number => { const q=Math.max(0,Math.min(1,n));return q*q*(3-2*q); };
export function mountedOffset(u: number, v: number, time: number, seed: number, gait: MountedGait): [number,number] {
  const phase=time*Math.PI*2/gait.period+seed*Math.PI*2;
  const bob=Math.cos(phase*2);
  let dx=.004*Math.sin(phase),dy=gait.bounce*bob;
  // Rider follows the saddle, with extra vertical travel at the shoulders.
  const rider=smooth((.50-v)/.20)*smooth((u-.36)/.12);
  dx+=rider*.012*Math.sin(phase);
  dy-=rider*.009*bob;
  // Head and reins respond to each step without moving the whole horse neck.
  const head=Math.max(0,1-((u-.32)/.13)**2-((v-.44)/.17)**2);
  dy+=head*.010*Math.sin(phase);
  for(const leg of gait.legs) {
    const progress=smooth((v-leg.root[1])/(leg.hoof[1]-leg.root[1]));
    if(!progress)continue;
    const center=leg.root[0]+(leg.hoof[0]-leg.root[0])*progress;
    const distance=Math.abs(u-center)/leg.width;
    if(distance>=1)continue;
    const weight=(1-distance*distance)**2*progress;
    const swing=Math.sin(phase+leg.phase);
    dx+=gait.stride*swing*weight;
    dy-=.034*Math.max(0,Math.cos(phase+leg.phase))*weight;
  }
  return [dx,dy];
}
