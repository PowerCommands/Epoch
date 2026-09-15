import type Phaser from 'phaser';

export type ScenicActivity = 'lumber_mill' | 'taj_mahal' | 'garden' | 'farm' | 'great_wall' | 'opera_house' | 'dock';
const tau = Math.PI * 2;
const smooth = (v: number) => { const q = Math.max(0, Math.min(1, v)); return q*q*(3-2*q); };

/** Texture-space activity: no simulation state or accumulated particles. */
export function drawScenicActivity(g: Phaser.GameObjects.Graphics, s: Phaser.GameObjects.Image, kind: ScenicActivity, t: number, seed: number, detail: number): void {
  const m = s.getWorldTransformMatrix();
  const size = Math.min(Math.abs(s.width*m.scaleX), Math.abs(s.height*m.scaleY));
  const alpha = s.alpha * Math.max(.7, detail);
  const at = (x: number, y: number) => m.transformPoint((x-s.originX)*s.width, (y-s.originY)*s.height);
  const line = (x: number,y: number,u: number,v: number,color: number,width=.004,a=1) => {
    const p=at(x,y),q=at(u,v); g.lineStyle(Math.max(.45,size*width),color,alpha*a).lineBetween(p.x,p.y,q.x,q.y);
  };
  const oval = (x: number,y: number,w: number,h: number,color: number,a=1) => {
    const p=at(x,y); g.fillStyle(color,alpha*a).fillEllipse(p.x,p.y,w*size,h*size);
  };
  const ring = (x: number,y: number,w: number,h: number,a=1) => {
    const p=at(x,y); g.lineStyle(Math.max(.5,size*.003),0xbcefff,alpha*a).strokeEllipse(p.x,p.y,w*size,h*size);
  };
  const person = (x: number,y: number,h: number,color: number,stride: number,a=1) => {
    line(x-.006,y-h*.28,x-.007+stride,y,0x302e29,.005,a);
    line(x+.006,y-h*.28,x+.007-stride,y,0x302e29,.005,a);
    oval(x,y-h*.49,h*.36,h*.55,color,a);
    oval(x,y-h*.88,h*.24,h*.25,0xe0b78c,a);
  };
  const time=t+seed*12;
  if(kind==='lumber_mill') {
    const q=(time%8)/8, feed=smooth(q/.45), drop=smooth((q-.5)/.3);
    // Feed along the bed, sever, then roll the cut section onto the foreground pile.
    const x=.33+feed*.14-drop*.16,y=.64-feed*.055+drop*.16;
    const fade=Math.min(1,q*24,(1-q)*16);
    line(x,y,x+.13,y-.065,0x64472c,.047,fade);
    line(x-.004,y-.014,x+.125,y-.077,0xae8450,.018,fade);
    oval(x,y,.040,.047,0xd5ad72,fade); oval(x,y,.022,.027,0x967048,fade);
    oval(.494,.478,.057,.105,0x737c7b); oval(.494,.478,.041,.082,0xb8c5c1);
    for(let n=0;n<14;n++) {
      const a=time*15+n*tau/14;
      line(.494+Math.cos(a)*.021,.478+Math.sin(a)*.041,.494+Math.cos(a)*.033,.478+Math.sin(a)*.057,0xd5ded6,.004);
    }
    oval(.494,.478,.009,.014,0x4a514d);
    if(q>.12&&q<.56) for(let n=0;n<16;n++) {
      const p=(time*2+n/16)%1,v=n*2.399;
      const cx=.487-Math.abs(Math.cos(v))*.17*p,cy=.53-.15*p+(.13+Math.sin(v)*.06)*p*p;
      line(cx,cy,cx+.009*Math.cos(v+time),cy+.007*Math.sin(v+time),0xe9c58a,.004,1-p);
    }
    return;
  }
  if(kind==='taj_mahal') {
    // Trapezoidal reflecting pool: wider ripples toward the near edge.
    for(let n=0;n<12;n++) {
      const q=(time*.23+n/12)%1,y=.79+q*.17,w=.006+q*.065;
      const a=Math.sin(q*Math.PI)*.8;
      line(.5-w,y,.5+w,y+.003*Math.sin(time*3+n),0xc4f4ed,.003,a);
      line(.5-w*.6,y+.007,.5+w*.7,y+.008,0x68b6c6,.004,a);
    }
    return;
  }
  if(kind==='garden') {
    oval(.5,.516,.13,.065,0xb6ac87); oval(.5,.51,.108,.043,0x407c86);
    line(.5,.501,.5,.425,0xbbefff,.009);
    // Radial jets rise, spread into a mushroom lip, and curl down into the bowl.
    for(let n=0;n<22;n++) {
      const a=n*tau/22;
      for(let k=0;k<12;k++) {
        const u=k/12,v=(k+1)/12;
        const px=(q:number)=>.5+Math.cos(a)*.054*Math.sin(q*Math.PI*.65);
        const py=(q:number)=>.49-.09*Math.sin(q*Math.PI)+Math.sin(a)*.023*q;
        line(px(u),py(u),px(v),py(v),n%2?0x95dbe5:0xe1ffff,.002,.38);
      }
      const q=(time*.8+n*.137)%1;
      oval(.5+Math.cos(a)*.054*Math.sin(q*Math.PI*.65),.49-.09*Math.sin(q*Math.PI)+Math.sin(a)*.023*q,.005,.009,0xe1ffff,.85);
    }
    for(let n=0;n<3;n++){const q=(time*.65+n/3)%1;ring(.5,.513,.1*q,.035*q,1-q);}
    return;
  }
  if(kind==='farm') {
    const q=(time%4)/4,swing=Math.sin(q*tau),x=.40,y=.66;
    // A small patch bends down with the cut and rises during the recovery.
    for(let n=0;n<8;n++) {
      const bend=smooth((q-.2)/.2)*(1-smooth((q-.8)/.2));
      const bx=.43+n*.009,by=.674+n*.003;
      line(bx,by,bx+.035*bend,by-.046*(1-bend),0xc8a348,.004);
      oval(bx+.035*bend,by-.046*(1-bend),.008,.018,0xe1c166);
    }
    person(x,y,.084,0x526b8c,0);
    oval(x,y-.079,.055,.012,0xbda269); oval(x,y-.087,.028,.020,0xc8ac73);
    const hx=x+.033+swing*.021,hy=y-.041-Math.cos(q*tau)*.016;
    line(x,y-.05,hx,hy,0xd8b18a,.007);
    line(hx-.015,hy-.036,hx+.038,hy+.019,0x67492d,.005);
    line(hx+.038,hy+.019,hx+.067,hy+.006,0xc6d3cd,.005);
    line(hx+.067,hy+.006,hx+.072,hy-.009,0xdde4db,.003);
    return;
  }
  if(kind==='great_wall') {
    // Separate exposed walkway sections; walkers disappear into each tower.
    const paths=[[.16,.77,.25,.62],[.31,.59,.43,.57],[.43,.57,.46,.46],[.48,.37,.60,.365],[.60,.365,.69,.235]];
    for(let n=0;n<10;n++) {
      const path=paths[Math.floor(n/2)],q=(time/7+n*.5)%1;
      const fade=Math.min(1,q*10,(1-q)*10);
      person(path[0]+(path[2]-path[0])*q,path[1]+(path[3]-path[1])*q,.036,[0x8c4434,0x466982,0xd3b473][n%3],Math.sin(time*8+n)*.004,fade);
    }
    return;
  }
  if(kind==='opera_house') {
    for(let row=0;row<4;row++) for(let n=0;n<12;n++) {
      const a=-1.55+n*.145,x=.49+Math.cos(a)*(.18+row*.018),y=.405+Math.sin(a)*(.11+row*.019);
      const wave=Math.sin(time*6+n*1.7+row);
      person(x,y,.026,[0x733e35,0x415a76,0xb39555][(n+row)%3],0);
      line(x-.004,y-.013,x-.010-wave*.003,y-.03-Math.abs(wave)*.008,0xdcb58b,.003);
      line(x+.004,y-.013,x+.010+wave*.003,y-.03-Math.abs(wave)*.008,0xdcb58b,.003);
    }
    const x=.435+Math.sin(time*.8)*.015,y=.436;
    const p=at(x,y-.075),l=at(x-.028,y-.009),r=at(x+.034+Math.sin(time*2)*.009,y);
    g.fillStyle(0x191822,alpha).fillTriangle(p.x,p.y,l.x,l.y,r.x,r.y);
    person(x,y,.086,0x22212c,Math.sin(time*2)*.004);
    oval(x+.005,y-.077,.013,.020,0xfff4db);
    line(x,y-.05,x+.04,y-.065+Math.sin(time*2)*.018,0x24232c,.009);
    oval(x+.04,y-.065+Math.sin(time*2)*.018,.011,.012,0xe2bd99);
    line(x,y-.063,x+.005,y-.043,0xeee9dc,.004);
    return;
  }
  // Dock: cast, let the float bob, hook the fish, reel in and repeat.
  const q=(time%10)/10,cast=smooth(q/.2),reel=smooth((q-.62)/.25);
  person(.73,.51,.09,0x53677b,0);
  oval(.73,.43,.042,.012,0xc6b17b);
  const tipX=.76+cast*.05-reel*.06,tipY=.38+cast*.075-reel*.1;
  line(.742,.46,tipX,tipY,0x896a3c,.004);
  const bx=.77+cast*.14-reel*.13,by=.49+cast*.17-reel*.2-Math.sin(Math.PI*cast)*.11;
  line(tipX,tipY,bx,by,0xd6ded5,.0015,.8);
  oval(bx,by,.012,.019,0xe05c42); oval(bx,by-.006,.009,.008,0xf7ebd5);
  if(q>.2&&q<.65) ring(bx,by+.008,.026+(.5+.5*Math.sin(time*5))*.017,.014,.6);
  if(q>.64&&q<.93) {
    const wiggle=Math.sin(time*24)*.006;
    oval(bx+wiggle,by+.027,.017,.037,0xc6e1d6);
    line(bx+wiggle,by+.04,bx-.01,by+.052,0x809f96,.006);
    line(bx+wiggle,by+.04,bx+.011,by+.052,0x809f96,.006);
  }
}
