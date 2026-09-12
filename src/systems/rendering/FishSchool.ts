/** Texture-space school: the original fish faces up/right at about -45°.
 * Each small fish follows its own elliptical lane, facing its travel direction. */
export const FISH_SCHOOL_COUNT = 8;
export function fishSchoolPose(index: number, t: number, seed: number) {
  const lane=index%3;
  const speed=.48+(index%4)*.018;
  const phase=t*speed+index*Math.PI*2/FISH_SCHOOL_COUNT+seed*Math.PI*2;
  const rx=.24+lane*.025,ry=.19+lane*.024;
  const x=.5+Math.cos(phase)*rx;
  const y=.5+Math.sin(phase)*ry;
  const angle=Math.atan2(Math.cos(phase)*ry,-Math.sin(phase)*rx)+Math.PI/4
    +Math.sin(t*7+index*2.3)*.065;
  return {x,y,angle,scale:.25+(index%3)*.02};
}
