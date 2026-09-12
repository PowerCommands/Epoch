import Phaser from 'phaser';
import { renderCanvasWithGeometryClip } from './GeometryClip';
import { AMBIENT_PROFILES, aircraftLaunchAge, ambientMotion, ambientSeed, type AmbientKind, type AmbientProfile, type Emitter } from './AmbientProfiles';
import { burstAge, weaponPhase, WEAPON_PERIOD, WEAPON_RELEASE } from './FootSoldierProfiles';
import { mountedOffset } from './MountedGait';

type CanvasDraw = (
  renderer: Phaser.Renderer.Canvas.CanvasRenderer, image: Phaser.GameObjects.GameObject,
  camera: Phaser.Cameras.Scene2D.Camera, parent?: Phaser.GameObjects.Components.TransformMatrix,
) => void;

type Binding = {
  sprite: Phaser.GameObjects.Image; kind: AmbientKind; key: string;
  tile: () => readonly [number, number]; enabled: () => boolean;
  grid: number; seed: number; motions: number[]; profile?: AmbientProfile; texture?: string;
  mesh?: Phaser.GameObjects.Mesh2D; drawing: boolean; release: () => void;
  lighting?: Phaser.Filters.ColorMatrix;
};
const systems = new WeakMap<Phaser.Scene, AmbientSprites>();
const DEPTH: Record<AmbientKind, number> = {resource:5.6,improvement:5.8,building:14.1,wonder:14.1,unit:18.01,city:19.7};
const GRID = 10;
const MAX_MESHES = 192;

/** Scene-owned, purely visual state. No tweens, timers, input handlers or
 * simulation subscriptions. Existing Images remain authoritative for position,
 * texture, visibility, tint, clipping, hit areas and destruction.
 * Phaser 4 Mesh2D replaces only their final WebGL drawing step, inside the
 * existing clip. Fixed mesh topology batches with the normal sprite renderer.
 * Canvas consumes the same visual vertices with a coarser grid and the same atlases.
 */
export class AmbientSprites {
  private readonly bindings = new Set<Binding>();
  private readonly layers = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly rotorTextures = new Map<string, string>();
  private elapsed = 0;
  private previousFrameTime?: number;
  private lastDraw = -Infinity;
  private disposed = false;
  private meshCount = 0;
  private readonly worldMatrix = new Phaser.GameObjects.Components.TransformMatrix();
  private readonly parentMatrix = new Phaser.GameObjects.Components.TransformMatrix();
  canSee: (x:number,y:number) => boolean = () => true;
  isEnabled: () => boolean = () => true;
  private readonly reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;

  static forScene(scene: Phaser.Scene): AmbientSprites {
    let system = systems.get(scene);
    if (!system) { system = new AmbientSprites(scene); systems.set(scene,system); }
    return system;
  }
  private constructor(private readonly scene: Phaser.Scene) {
    scene.events.on(Phaser.Scenes.Events.UPDATE,this.tick,this);
    for (const event of [Phaser.Scenes.Events.PAUSE, Phaser.Scenes.Events.RESUME, Phaser.Scenes.Events.SLEEP, Phaser.Scenes.Events.WAKE]) {
      scene.events.on(event, this.resetClock);
    }
    document.addEventListener('visibilitychange', this.resetClock);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN,this.shutdown,this);
  }
  attach(sprite: Phaser.GameObjects.Image, kind: AmbientKind, key: string,
    tile: Binding['tile'], enabled: Binding['enabled'] = () => true, clipped = true): void {
    const b: Binding = {sprite,kind,key,tile,enabled,grid:this.scene.renderer.type === Phaser.WEBGL ? GRID : 4,seed:ambientSeed(`${kind}:${key}`),motions:[],drawing:false,release:()=>{}};
    b.release = () => { this.dropMesh(b); this.bindings.delete(b); };
    this.bindings.add(b);
    sprite.once(Phaser.GameObjects.Events.DESTROY,b.release);
    if (this.scene.renderer.type === Phaser.WEBGL) {
      // GeometryClip occupies step zero when present. The ambient step must
      // execute inside it, so the replacement shares the original hex/circle.
      sprite.addRenderStep((renderer,target,context,parent,step=0,list,index) => {
        if (!this.disposed && b.drawing && b.mesh && !sprite.isTinted && b.enabled()
          && this.canSee(...b.tile())) {
          const m = b.mesh;
          // Filter bounds need the same ancestry as the image they replace.
          m.parentContainer=sprite.parentContainer;
          m.setPosition(sprite.x,sprite.y).setScale(sprite.scaleX,sprite.scaleY).setRotation(sprite.rotation);
          m.setAlpha(sprite.alpha).setScrollFactor(sprite.scrollFactorX,sprite.scrollFactorY);
          m.setBlendMode(sprite.blendMode);
          // Meshes can cross the batch's texture limit midway through their
          // triangles. Isolate each replacement, including cloth deformation,
          // so texture switches cannot leave holes in the artwork.
          renderer.renderNodes.finishBatch();
          m.renderWebGLStep(renderer,m,context,parent);
          renderer.renderNodes.finishBatch();
        } else sprite.renderWebGLStep(renderer,target,context,parent,step+1,list,index);
      }, clipped ? 1 : 0);
    } else {
      // Canvas has no native Mesh2D renderer. Consume the same visual vertices
      // and rotor atlas through Canvas transforms, inside the existing clip.
      const target = sprite as Phaser.GameObjects.Image & { renderCanvas: CanvasDraw };
      const original = target.renderCanvas;
      target.renderCanvas = (renderer, image, camera, parent) => {
        if (!this.disposed && b.drawing && b.mesh && !sprite.isTinted && b.enabled() && this.canSee(...b.tile())) {
          renderCanvasWithGeometryClip(sprite, renderer, camera, () => this.drawCanvas(b, renderer, camera, parent));
        } else if(b.profile?.brightness) {
          const ctx=renderer.currentContext;ctx.save();ctx.filter=`brightness(${b.profile!.brightness})`;
          try {original.call(target,renderer,image,camera,parent);} finally {ctx.restore();}
        } else original.call(target, renderer, image, camera, parent);
      };
    }
    // The source filter also lights the still image when motion is disabled.
    this.resolve(b);
  }
  private dropMesh(b: Binding): void {
    if (b.mesh) { b.mesh.destroy(); b.mesh=undefined; this.meshCount--; }
    b.drawing=false;
  }
  private resolve(b: Binding): void {
    const texture=b.sprite.texture.key;
    if (b.texture === texture) return;
    this.dropMesh(b); b.texture=texture;
    if(b.kind==='building' || b.kind==='wonder') b.kind=texture.startsWith('tile_wonder_')?'wonder':'building';
    const prefix: Record<AmbientKind,string> = {resource:'resource_',improvement:'improvement_',building:'tile_building_',wonder:'tile_wonder_',unit:'unit_',city:'city_'};
    const id=texture.startsWith(prefix[b.kind]) ? texture.slice(prefix[b.kind].length) : '';
    b.profile=AMBIENT_PROFILES[b.kind][id];
    if(b.lighting) {b.sprite.filters?.internal.remove(b.lighting);b.lighting=undefined;}
    if(b.profile?.brightness && this.scene.renderer.type===Phaser.WEBGL) {
      b.sprite.enableFilters();
      b.lighting=b.sprite.filters!.internal.addColorMatrix();
      b.lighting.colorMatrix.brightness(b.profile.brightness);
      if(b.profile.shadowLift) this.liftShadows(b.lighting,b.profile.shadowLift);
    }
  }
  private liftShadows(filter: Phaser.Filters.ColorMatrix, amount: number): void {
    filter.colorMatrix.multiply([1,0,0,0,amount, 0,1,0,0,amount, 0,0,1,0,amount, 0,0,0,1,0],true);
  }
  private makeMesh(b: Binding): void {
    if (this.meshCount>=MAX_MESHES) return;
    b.grid=this.scene.renderer.type===Phaser.WEBGL?GRID:4;
    if(b.profile?.gait) b.grid=32;
    // Rigid artwork needs only one base quad. Subdividing it wastes vertices
    // when many independently armed soldiers share the screen.
    if(b.profile?.parts?.length && !b.profile.joints?.length && !b.profile.gait) b.grid=1;
    // Small hand/head/crop regions need a vertex inside the feature on Canvas
    // too. Rigid cutouts still use the coarse grid and only a few moving quads.
    if(this.scene.renderer.type!==Phaser.WEBGL && b.profile?.joints?.some(j=>j.radius<.15)) b.grid=8;
    const sprite=b.sprite, grid=b.grid, vertices:number[]=[], indices:number[]=[];
    for(let row=0;row<=grid;row++) for(let col=0;col<=grid;col++) {
      vertices.push((col/grid-sprite.originX)*sprite.width,(row/grid-sprite.originY)*sprite.height,col/grid,row/grid);
    }
    for(let row=0;row<grid;row++) for(let col=0;col<grid;col++) {
      const a=row*(grid+1)+col,c=a+grid+1;
      indices.push(a,a+1,c,0,a+1,c+1,c,0);
    }
    // Not added to the display list: rendered in place of the Image, never
    // independently. Original image remains the interactive object.
    b.mesh=new Phaser.GameObjects.Mesh2D(this.scene,0,0,sprite.texture,vertices,indices,true);
    if(b.profile?.brightness && this.scene.renderer.type===Phaser.WEBGL) {
      b.mesh.enableFilters();
      const light=b.mesh.filters!.internal.addColorMatrix();
      light.colorMatrix.brightness(b.profile.brightness);
      if(b.profile.shadowLift) this.liftShadows(light,b.profile.shadowLift);
    }
    b.mesh.setSize(sprite.width,sprite.height).setOrigin(sprite.originX,sprite.originY);
    b.mesh.buildOrderedIndices(0); b.mesh.setUseOrderedIndices(true);
    this.meshCount++;
  }
  private readonly resetClock = (): void => { this.previousFrameTime = undefined; };

  private tick(time: number): void {
    if (document.hidden) { this.resetClock(); return; }
    // Phaser's delta is smoothed and substitutes the previous "sane" frame
    // delta on slow frames. That turns seven-second rotors into minute-long
    // rotors on a busy map. RAF time is monotonic and independent of game speed.
    const delta = this.previousFrameTime === undefined ? 0 : Math.max(0, time - this.previousFrameTime);
    this.previousFrameTime = time;
    this.update(time, delta);
  }

  private update(_time:number,delta:number): void {
    if(this.disposed) return;
    this.elapsed+=Math.max(0,delta);
    if(this.elapsed-this.lastDraw<40) return;
    this.lastDraw=this.elapsed;
    for(const layer of this.layers.values()) layer.clear();
    const camera=this.scene.cameras.main, view=camera.worldView;
    const detail=this.reducedMotion?.matches || !this.isEnabled() ? 0 : Phaser.Math.Clamp((camera.zoom-.45)/.7,0,1);
    const t=this.elapsed/1000;
    for(const b of this.bindings) {
      b.drawing=false;
      const s=b.sprite;
      this.resolve(b);
      if(!detail || !s.visible || !s.active || !s.alpha || !b.enabled() || !this.canSee(...b.tile())) {this.dropMesh(b);continue;}
      let parent=s.parentContainer, visible=true;
      while(parent) {if(!parent.visible || !parent.alpha || !parent.active){visible=false;break;} parent=parent.parentContainer;}
      if(!visible) {this.dropMesh(b);continue;}
      const matrix=s.getWorldTransformMatrix(this.worldMatrix,this.parentMatrix);
      const x=matrix.tx,y=matrix.ty,w=s.width*matrix.scaleX,h=s.height*matrix.scaleY;
      if(x<view.left-w || x>view.right+w || y<view.top-h || y>view.bottom+h) {this.dropMesh(b);continue;}
      const profile=b.profile;
      if(!profile) continue;
      if(profile.joints?.length || profile.float || profile.gait) {
        if(!b.mesh) this.makeMesh(b);
        if(b.mesh) {
          const vertices=b.mesh.vertices, grid=b.grid;
          b.motions.length=profile.joints?.length??0;
          for(let k=0;k<(profile.joints?.length??0);k++) b.motions[k]=ambientMotion(t,(b.seed+k*.173)%1,profile.joints![k].rhythm)*detail;
          // During an organic rest, the original one-quad Image is identical.
          // Retain the mesh for the next gesture without submitting idle geometry.
          b.drawing=!!profile.float || !!profile.gait || b.motions.some(value=>Math.abs(value)>1e-6);
          if(b.drawing) for(let row=0;row<=grid;row++) for(let col=0;col<=grid;col++) {
            const u=col/grid,v=row/grid; let dx=0,dy=(profile.float??0)*ambientMotion(t,b.seed,'sea')*detail;
            if(profile.gait) {
              const offset=mountedOffset(u,v,t,b.seed,profile.gait);
              // Keep the gait legible at intermediate zoom, like rigid attacks.
              dx+=offset[0];dy+=offset[1];
            }
            for(let k=0;k<(profile.joints?.length??0);k++) {
              const joint=profile.joints![k];
              const distance=Math.hypot(u-joint.x,v-joint.y)/joint.radius;
              if(distance>=1) continue;
              const weight=(1-distance*distance)**2;
              const motion=b.motions[k]*weight;
              dx+=joint.dx*motion;dy+=joint.dy*motion;
              if(joint.angle) {
                const angle=joint.angle*motion,px=u-joint.x,py=v-joint.y;
                dx+=px*(Math.cos(angle)-1)-py*Math.sin(angle);
                dy+=px*Math.sin(angle)+py*(Math.cos(angle)-1);
              }
            }
            const i=(row*(grid+1)+col)*4;
            vertices[i]=(u+dx-s.originX)*s.width;vertices[i+1]=(v+dy-s.originY)*s.height;
          }
        }
      }
      let depth=DEPTH[b.kind];
      if(b.kind==='resource') depth=s.depth+.01;
      let g=this.layers.get(depth);
      if(!g && (profile.effects.length || profile.rotors?.length || profile.parts?.length)) {
        g=this.scene.add.graphics().setDepth(depth).setName(`ambient-objects-${depth}`);
        this.layers.set(depth,g);
      }
      if(!g) continue;
      // Effects use the same texture-space anchors as the deformation. Local
      // coordinates respect capital size and the unit's visual container.
      for(let i=0;i<profile.effects.length;i++) {
        const effect=profile.effects[i];
        const point=matrix.transformPoint((effect.x-s.originX)*s.width,(effect.y-s.originY)*s.height);
        // The compass face replaces painted artwork, so keep it opaque even
        // at medium zoom; otherwise the old needle shows through the dial.
        this.drawEffect(g,effect,point.x,point.y,Math.min(Math.abs(w),Math.abs(h)),t,(b.seed+i*.271)%1,(effect.kind==='compass'?1:detail)*s.alpha);
      }
      if(profile.rotors?.length || profile.parts?.length) this.drawRotors(b,t,detail);
      if(profile.bombs || profile.parts?.some(part=>part.launch)) this.drawAircraftWeapons(g,b,t,detail);
      if(profile.shots?.length && b.drawing && !s.isTinted) this.drawWeaponShots(g,b,t,detail);
      if(profile.tracks?.length && b.drawing && !s.isTinted) this.drawTracks(g,b,t,detail);
    }
  }
  private drawWeaponShots(g: Phaser.GameObjects.Graphics,b: Binding,t: number,detail: number): void {
    const s=b.sprite,parts=b.profile!.parts!;
    const matrix=s.getWorldTransformMatrix(this.worldMatrix,this.parentMatrix);
    for(const shot of b.profile!.shots!) {
      const seed=(b.seed+(parts[shot.part].phase??shot.part*.173))%1;
      const phase=weaponPhase(t,seed);
      const elapsed=shot.kind==='burst'?(burstAge(t,seed)??-1):(phase-WEAPON_RELEASE)*WEAPON_PERIOD;
      const age=Math.max(0,elapsed);
      const duration=shot.kind==='stone'?1.05:shot.kind==='shell'?.65:shot.kind==='burst'?.14:shot.kind==='arrow'?.48:.36;
      const loaded=shot.kind==='stone' && phase<WEAPON_RELEASE;
      if((elapsed < -1e-9 && !loaded) || age>duration) continue;
      // The stone leaves the cup at release and no longer follows its recovery.
      const poseTime=shot.kind==='stone' && !loaded?t-age:t;
      const part=parts[shot.part],motion=ambientMotion(poseTime,seed,part.rhythm);
      const local=(x:number,y:number,pose=motion) => {
        const angle=part.angle*pose+(part.angleOffset??0),cos=Math.cos(angle),sin=Math.sin(angle);
        return matrix.transformPoint(
          (part.pivot[0]+(x-part.pivot[0])*cos-(y-part.pivot[1])*sin+(part.dx??0)*pose-s.originX)*s.width,
          (part.pivot[1]+(x-part.pivot[0])*sin+(y-part.pivot[1])*cos+(part.dy??0)*pose+(b.profile!.float??0)*ambientMotion(t,b.seed,'sea')*detail-s.originY)*s.height);
      };
      const muzzle=local(...shot.muzzle),tip=local(shot.muzzle[0]+shot.direction[0],shot.muzzle[1]+shot.direction[1]);
      const scale=Math.hypot(tip.x-muzzle.x,tip.y-muzzle.y);
      const dx=(tip.x-muzzle.x)/scale,dy=(tip.y-muzzle.y)/scale,nx=-dy,ny=dx;
      const alpha=s.alpha*Math.max(.7,detail);
      if(shot.kind==='stone') {
        // Velocity and gravity are in sprite space, preserving container scale
        // and rotation without coupling projectile travel to the arm angle.
        const distance=loaded?0:age;
        const offset=matrix.transformPoint(
          shot.direction[0]*distance*s.width,
          (shot.direction[1]*distance+.43*distance*distance)*s.height);
        const x=muzzle.x+offset.x-matrix.tx,y=muzzle.y+offset.y-matrix.ty;
        const radius=Math.max(2.2,scale*.032),fade=loaded?1:Math.min(1,(duration-age)/.18);
        g.fillStyle(0x38332a,alpha*fade).fillCircle(x,y,radius);
        g.fillStyle(0xa4977d,alpha*fade).fillCircle(x-radius*.12,y-radius*.15,radius*.78);
        g.fillStyle(0xd3c8ad,alpha*fade).fillCircle(x-radius*.32,y-radius*.34,radius*.26);
      } else if(shot.kind==='arrow') {
        const travel=age/duration*.32*scale,x=muzzle.x+dx*travel,y=muzzle.y+dy*travel;
        const length=scale*.105;
        g.lineStyle(Math.max(1.2,scale*.007),0xf5dfac,alpha*(1-age/duration*.6));
        g.lineBetween(x-dx*length,y-dy*length,x,y);
        g.lineBetween(x,y,x-dx*scale*.022+nx*scale*.014,y-dy*scale*.022+ny*scale*.014);
        g.lineBetween(x,y,x-dx*scale*.022-nx*scale*.014,y-dy*scale*.022-ny*scale*.014);
      } else {
        if(age<(shot.kind==='burst'?.085:.15)) {
          const length=scale*(shot.kind==='shell'?.22:shot.kind==='burst'?.18:shot.kind==='rocket'?.14:.10)*(1-age*.9),width=scale*(shot.kind==='shell'?.055:shot.kind==='burst'?.04:.025);
          g.fillStyle(0xffad35,alpha*.9);
          g.fillTriangle(muzzle.x+nx*width,muzzle.y+ny*width,muzzle.x+dx*length,muzzle.y+dy*length,muzzle.x-nx*width,muzzle.y-ny*width);
          g.fillStyle(0xfff3c2,alpha).fillCircle(muzzle.x+dx*scale*.025,muzzle.y+dy*scale*.025,scale*.016);
        }
        const q=age/duration;
        g.fillStyle(0xd8d0b9,(1-q)*alpha*.48);
        g.fillCircle(muzzle.x+dx*q*scale*.12,muzzle.y+dy*q*scale*.12-q*scale*.025,scale*(.013+q*.028));
        if(shot.kind==='shell') {
          const origin=local(shot.muzzle[0],shot.muzzle[1],ambientMotion(t-age,seed,part.rhythm));
          const travel=q*scale*.95;
          g.lineStyle(Math.max(2,scale*.018),0xffd78a,alpha*(1-q));
          g.lineBetween(origin.x+dx*travel,origin.y+dy*travel,origin.x+dx*(travel+scale*.045),origin.y+dy*(travel+scale*.045));
        }
        if(shot.kind==='burst') {
          const travel=q*scale*.30;
          g.lineStyle(Math.max(1.2,scale*.008),0xffdf87,(1-q)*alpha);
          g.lineBetween(muzzle.x+dx*travel,muzzle.y+dy*travel,muzzle.x+dx*(travel+scale*.08),muzzle.y+dy*(travel+scale*.08));
        }
        if(shot.kind==='rocket') {
          const travel=q*scale*.30;
          g.lineStyle(Math.max(1.5,scale*.014),0xe9d6ac,(1-q)*alpha);
          g.lineBetween(muzzle.x+dx*travel,muzzle.y+dy*travel,muzzle.x+dx*(travel+scale*.055),muzzle.y+dy*(travel+scale*.055));
        }
      }
    }
  }
  private drawAircraftWeapons(g: Phaser.GameObjects.Graphics,b: Binding,t: number,detail: number): void {
    const s=b.sprite,matrix=s.getWorldTransformMatrix(this.worldMatrix,this.parentMatrix);
    const local=(x:number,y:number)=>matrix.transformPoint((x-s.originX)*s.width,(y-s.originY)*s.height);
    const size=Math.min(Math.abs(s.width*matrix.scaleX),Math.abs(s.height*matrix.scaleY));
    const alpha=s.alpha*Math.max(.7,detail);
    for(const part of b.profile!.parts??[]) {
      if(!part.launch || !b.drawing) continue;
      const age=aircraftLaunchAge(t,b.seed,part.launch.delay);
      if(age<0 || age>.9) continue;
      const q=age/.9,travel=q*q;
      const x=part.pivot[0]+part.launch.travel[0]*travel,y=part.pivot[1]+part.launch.travel[1]*travel-.045;
      const nozzle=local(x,y),tip=local(x,y-.10-.08*q);
      g.lineStyle(Math.max(1,size*.013),0xffab4f,alpha);
      g.lineBetween(nozzle.x,nozzle.y,tip.x,tip.y);
      g.lineStyle(Math.max(.6,size*.006),0xf4faff,alpha);
      g.lineBetween(nozzle.x,nozzle.y,tip.x,tip.y);
      for(let n=1;n<=4;n++) {
        const smoke=local(x,y-.05-n*.035);
        g.fillStyle(0xd9e0e5,alpha*(1-n/5)*.35).fillCircle(smoke.x,smoke.y,size*(.008+n*.004));
      }
    }
    if(b.profile!.bombs) for(let n=0;n<3;n++) {
      const age=aircraftLaunchAge(t,b.seed,n*.3);
      if(age<0 || age>1.4) continue;
      const q=age/1.4,point=local(.50+(n%2===0?-.035:.035),.59+q*q*.62);
      const scale=size*(1-q*.45),fade=alpha*Math.min(1,(1-q)*5);
      g.fillStyle(0x070d16,.28*fade).fillEllipse(point.x+scale*.02,point.y+scale*.025,scale*.065,scale*.10);
      g.fillStyle(0x202c3c,fade).fillTriangle(point.x-scale*.026,point.y-scale*.043,point.x+scale*.026,point.y-scale*.043,point.x,point.y);
      g.fillStyle(0x85929d,fade).fillEllipse(point.x,point.y,scale*.035,scale*.075);
      g.fillStyle(0xe6bd62,fade).fillRect(point.x-scale*.014,point.y+scale*.012,scale*.028,scale*.009);
      g.fillStyle(0xe4eaf0,.65*fade).fillEllipse(point.x-scale*.006,point.y-scale*.005,scale*.008,scale*.045);
    }
  }
  private drawTracks(g: Phaser.GameObjects.Graphics,b: Binding,t: number,detail: number): void {
    const s=b.sprite,matrix=s.getWorldTransformMatrix(this.worldMatrix,this.parentMatrix);
    const local=(x:number,y:number)=>matrix.transformPoint((x-s.originX)*s.width,(y-s.originY)*s.height);
    for(const belt of b.profile!.tracks!) {
      const lengths=belt.path.map(([x,y],i)=>{const next=belt.path[(i+1)%belt.path.length];return Math.hypot(next[0]-x,next[1]-y);});
      const total=lengths.reduce((sum,len)=>sum+len,0);
      for(let n=0;n<belt.links;n++) {
        let distance=((n/belt.links+t/belt.period+b.seed)%1)*total,segment=0;
        while(segment<lengths.length-1 && distance>lengths[segment]) distance-=lengths[segment++];
        const [x,y]=belt.path[segment],[tx,ty]=belt.path[(segment+1)%belt.path.length];
        const len=lengths[segment],q=distance/len,nx=-(ty-y)/len*belt.width/2,ny=(tx-x)/len*belt.width/2;
        const px=x+(tx-x)*q,py=y+(ty-y)*q;
        const a=local(px-nx,py-ny),c=local(px+nx,py+ny);
        g.lineStyle(Math.max(.8,Math.abs(s.displayWidth)*.005),n%3===0?0xb0a18a:0x655e50,s.alpha*Math.max(.7,detail));
        g.lineBetween(a.x,a.y,c.x,c.y);
      }
    }
  }
  private drawRotors(b:Binding,t:number,detail:number): void {
    if(!b.mesh) this.makeMesh(b);
    if(!b.mesh) return;
    const parts=b.profile!.parts;
    const rotors=b.profile!.rotors??[], count=parts?.length??rotors.length, s=b.sprite, m=b.mesh;
    const base=parts?this.partBase(b):this.rotorBase(b);
    if(m.texture.key!==base) {
      m.setTexture(base);
      // A single tiny atlas: base in cell zero, original rotor cutouts in the
      // other cells. Appending quads keeps everything in one batched Mesh2D.
      for(let i=0;i<m.vertices.length;i+=4) m.vertices[i+2]/=count+1;
      for(let n=0;n<count;n++) {
        const a=m.vertices.length/4;
        for(const [u,v] of [[0,0],[1,0],[0,1],[1,1]]) m.vertices.push(0,0,(n+1+u)/(count+1),v);
        m.indices.push(a,a+1,a+2,0,a+1,a+3,a+2,0);
      }
      m.buildOrderedIndices(0);
    }
    for(let n=0;n<count;n++) {
      const part=parts?.[n], r=part?{x:part.pivot[0],y:part.pivot[1],period:1}:rotors[n];
      let motion=part?ambientMotion(t,(b.seed+(part.phase??n*.173))%1,part.rhythm):0;
      if(part?.positive) motion=Math.abs(motion);
      let angle=part?part.angle*motion+(part.angleOffset??0):t*Math.PI*2/r.period+b.seed*31+n*1.7;
      if(part?.spin) angle=t*Math.PI*2/part.spin.period+b.seed*Math.PI*2;
      const heave=(b.profile!.float??0)*ambientMotion(t,b.seed,'sea')*detail;
      let moveX=(part?.dx??0)*motion,moveY=(part?.dy??0)*motion+heave;
      const launchAge=part?.launch?aircraftLaunchAge(t,b.seed,part.launch.delay):-1;
      if(part?.launch) {
        const travel=(Math.max(0,Math.min(.9,launchAge))/.9)**2;
        moveX=part.launch.travel[0]*travel;moveY=part.launch.travel[1]*travel;
      }
      if(part?.link && parts) {
        const {hand,root,elbow,bone}=part.link,parent=parts[part.link.part];
        let pm=ambientMotion(t,(b.seed+(parent.phase??part.link.part*.173))%1,parent.rhythm);
        if(parent.positive) pm=Math.abs(pm);
        const pa=parent.angle*pm+(parent.angleOffset??0),hx=hand[0]-parent.pivot[0],hy=hand[1]-parent.pivot[1];
        const tx=parent.pivot[0]+hx*Math.cos(pa)-hy*Math.sin(pa)+(parent.dx??0)*pm;
        const ty=parent.pivot[1]+hx*Math.sin(pa)+hy*Math.cos(pa)+(parent.dy??0)*pm;
        const upper=Math.hypot(elbow[0]-root[0],elbow[1]-root[1]);
        const lower=Math.hypot(hand[0]-elbow[0],hand[1]-elbow[1]);
        const distance=Math.max(1e-6,Math.hypot(tx-root[0],ty-root[1]));
        const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
        const bend=Math.sqrt(Math.max(0,upper*upper-along*along));
        const ux=(tx-root[0])/distance,uy=(ty-root[1])/distance;
        const ex=root[0]+ux*along-uy*bend,ey=root[1]+uy*along+ux*bend;
        if(bone===0) angle=Math.atan2(ey-root[1],ex-root[0])-Math.atan2(elbow[1]-root[1],elbow[0]-root[0]);
        else {
          angle=Math.atan2(ty-ey,tx-ex)-Math.atan2(hand[1]-elbow[1],hand[0]-elbow[0]);
          moveX=ex-elbow[0];moveY=ey-elbow[1]+heave;
        }
      }
      for(let k=0;k<4;k++) {
        const hidden=!!part?.launch && launchAge>.9;
        const u=hidden?r.x:k%2,v=hidden?r.y:Math.floor(k/2),dx=(u-r.x)*s.width,dy=(v-r.y)*s.height;
        const i=((b.grid+1)**2+n*4+k)*4;
        const aspect=part?.spin?.aspect??1;
        m.vertices[i]=(r.x-s.originX)*s.width+dx*Math.cos(angle)-dy*Math.sin(angle)*aspect+moveX*s.width;
        m.vertices[i+1]=(r.y-s.originY)*s.height+dx*Math.sin(angle)/aspect+dy*Math.cos(angle)+moveY*s.height;
      }
    }
    b.drawing=true;
  }
  private drawCanvas(b: Binding, renderer: Phaser.Renderer.Canvas.CanvasRenderer,
    camera: Phaser.Cameras.Scene2D.Camera, parent?: Phaser.GameObjects.Components.TransformMatrix): void {
    const mesh = b.mesh!, sprite = b.sprite, ctx = renderer.currentContext;
    camera.addToRenderList(sprite);
    if (!Phaser.Renderer.Canvas.SetTransform(renderer, ctx, sprite, camera, parent)) return;
    try {
      if(b.profile?.brightness) ctx.filter=`brightness(${b.profile!.brightness})`;
      const source = mesh.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const vertices = mesh.vertices;
      if (b.profile?.rotors?.length || b.profile?.parts?.length) {
        // Rigid rotor quads need no triangulation. Draw the stationary atlas
        // cell once and apply an affine transform for each original-art cutout.
        const count = b.profile.parts?.length ?? b.profile.rotors!.length;
        const cells = count + 1, cell = source.width / cells;
        ctx.drawImage(source, 0, 0, cell, source.height,
          -sprite.originX * sprite.width, vertices[1], sprite.width, sprite.height);
        for (let n = 0; n < count; n++) {
          const i = ((b.grid + 1) ** 2 + n * 4) * 4;
          ctx.save();
          ctx.transform((vertices[i + 4] - vertices[i]) / cell, (vertices[i + 5] - vertices[i + 1]) / cell,
            (vertices[i + 8] - vertices[i]) / source.height, (vertices[i + 9] - vertices[i + 1]) / source.height,
            vertices[i], vertices[i + 1]);
          ctx.drawImage(source, (n + 1) * cell, 0, cell, source.height, 0, 0, cell, source.height);
          ctx.restore();
        }
        return;
      }
      // Four-by-four Canvas grid (32 triangles), and only during a gesture.
      // Phaser Images still draw ordinary rests as one quad.
      for (let i = 0; i < mesh.indices.length; i += 4) {
        const a = mesh.indices[i] * 4, b = mesh.indices[i + 1] * 4, c = mesh.indices[i + 2] * 4;
        const sx = vertices[a + 2] * source.width, sy = vertices[a + 3] * source.height;
        const ux = vertices[b + 2] * source.width - sx, uy = vertices[b + 3] * source.height - sy;
        const vx = vertices[c + 2] * source.width - sx, vy = vertices[c + 3] * source.height - sy;
        const det = ux * vy - uy * vx;
        if (Math.abs(det) < 1e-8) continue;
        const dx = vertices[b] - vertices[a], dy = vertices[b + 1] - vertices[a + 1];
        const ex = vertices[c] - vertices[a], ey = vertices[c + 1] - vertices[a + 1];
        const aa = (dx * vy - ex * uy) / det, bb = (dy * vy - ey * uy) / det;
        const cc = (ex * ux - dx * vx) / det, dd = (ey * ux - dy * vx) / det;
        ctx.save();
        ctx.beginPath();ctx.moveTo(vertices[a], vertices[a + 1]);
        ctx.lineTo(vertices[b], vertices[b + 1]);ctx.lineTo(vertices[c], vertices[c + 1]);ctx.closePath();ctx.clip();
        ctx.transform(aa, bb, cc, dd, vertices[a] - aa * sx - cc * sy, vertices[a + 1] - bb * sx - dd * sy);
        ctx.drawImage(source, 0, 0);ctx.restore();
      }
    } finally { ctx.restore(); }
  }

  private partBase(b: Binding): string {
    const texture=b.sprite.texture.key, cached=this.rotorTextures.get(texture);
    if(cached) return cached;
    const source=b.sprite.texture.getSourceImage() as HTMLImageElement;
    const parts=b.profile!.parts!, cell=Math.min(512,Math.floor(4096/(parts.length+1)),Math.max(source.width,source.height));
    const key=`__ambient_parts_${texture}`, atlas=this.scene.textures.createCanvas(key,cell*(parts.length+1),cell)!;
    const ctx=atlas.context;ctx.drawImage(source,0,0,cell,cell);
    const path=(g:CanvasRenderingContext2D,points:readonly (readonly number[])[])=>{
      g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x*cell,y*cell):g.moveTo(x*cell,y*cell));g.closePath();
    };
    for(const [n,part] of parts.entries()) {
      // The mask follows the painted feature, never a radial torso influence.
      ctx.save();ctx.translate((n+1)*cell,0);path(ctx,part.polygon);ctx.clip();ctx.drawImage(source,0,0,cell,cell);ctx.restore();
      ctx.save();path(ctx,part.polygon);ctx.clip();ctx.clearRect(0,0,cell,cell);
      for(const repair of part.repairs??[]) {
        ctx.save();path(ctx,repair.polygon);ctx.clip();
        ctx.drawImage(source,repair.offset[0]*cell,repair.offset[1]*cell,cell,cell);ctx.restore();
      }
      ctx.restore();
    }
    atlas.refresh();this.rotorTextures.set(texture,key);return key;
  }

  private rotorBase(b:Binding): string {
    const texture=b.sprite.texture.key;
    const cached=this.rotorTextures.get(texture);if(cached) return cached;
    const source=b.sprite.texture.getSourceImage() as HTMLImageElement;
    const rotors=b.profile!.rotors!, cell=Math.min(512,Math.max(source.width,source.height));
    const key=`__ambient_base_${texture}`;
    const canvas=this.scene.textures.createCanvas(key,cell*(rotors.length+1),cell)!;
    const ctx=canvas.context;ctx.drawImage(source,0,0,cell,cell);
    const mask=document.createElement('canvas');mask.width=cell;mask.height=cell;
    const mc=mask.getContext('2d')!;
    for(let n=0;n<rotors.length;n++) {
      const r=rotors[n];mc.clearRect(0,0,cell,cell);mc.fillStyle='#fff';
      // Source-space envelopes follow each painted blade, including its red
      // tip. Only the cutout rotates; mast, nacelle and platform stay fixed.
      for(const [tx,ty] of r.tips) {
        const dx=tx-r.x,dy=ty-r.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
        const width=r.blades===4?.038:r.radius*.075;
        const extension=r.blades===4?.12:.018, taper=r.blades===4?1:.3;
        mc.beginPath();
        mc.moveTo((r.x+nx*width)*cell,(r.y+ny*width)*cell);
        mc.lineTo((r.x+dx*.45+nx*width)*cell,(r.y+dy*.45+ny*width)*cell);
        mc.lineTo((tx+dx*extension+nx*width*taper)*cell,(ty+dy*extension+ny*width*taper)*cell);
        mc.lineTo((tx+dx*extension-nx*width*taper)*cell,(ty+dy*extension-ny*width*taper)*cell);
        mc.lineTo((r.x+dx*.45-nx*width)*cell,(r.y+dy*.45-ny*width)*cell);
        mc.lineTo((r.x-nx*width)*cell,(r.y-ny*width)*cell);mc.closePath();mc.fill();
      }
      mc.beginPath();mc.arc(r.x*cell,r.y*cell,cell*(r.blades===4?.026:.023),0,Math.PI*2);mc.fill();
      const part=document.createElement('canvas');part.width=cell;part.height=cell;
      const pc=part.getContext('2d')!;pc.drawImage(source,0,0,cell,cell);
      pc.globalCompositeOperation='destination-in';pc.drawImage(mask,0,0);
      ctx.save();ctx.globalCompositeOperation='destination-out';ctx.drawImage(mask,0,0);ctx.restore();
      ctx.drawImage(part,(n+1)*cell,0);
      // Repair only the small occluded supporting surface. Windmill roof
      // timber is sampled from the neighboring unoccluded face; turbine mast
      // shading comes from the same mast immediately below the hub.
      ctx.save();ctx.beginPath();
      if(r.blades===4) {
        ctx.moveTo(.5*cell,.235*cell);ctx.lineTo(.575*cell,.32*cell);
        ctx.lineTo(.60*cell,.66*cell);ctx.lineTo(.40*cell,.66*cell);ctx.lineTo(.425*cell,.32*cell);
      } else {
        ctx.rect((r.x-.005)*cell,(r.y+.005)*cell,.042*cell,.07*cell);
      }
      ctx.clip();
      const pixels=ctx.getImageData(0,0,cell,cell), original=pc.getImageData(0,0,cell,cell);
      // Fill small transparent holes under moving parts, keeping all intact
      // source pixels. Repair is deliberately confined to the support polygon.
      const repair=document.createElement('canvas');repair.width=cell;repair.height=cell;
      const rc=repair.getContext('2d')!;
      rc.drawImage(source,0,0,cell,cell);
      const src=rc.getImageData(0,0,cell,cell);
      for(let y=0;y<cell;y++)for(let x=0;x<cell;x++) {
        const at=(y*cell+x)*4;
        if(pixels.data[at+3]>200 || original.data[at+3]<30) continue;
        const sampleX=Math.round((r.blades===4?.51:r.x+.014)*cell);
        const sampleY=r.blades===4?Math.round(.57*cell):Math.round((r.y+.12)*cell);
        const sample=(sampleY*cell+sampleX)*4;
        for(let c=0;c<4;c++) pixels.data[at+c]=src.data[sample+c];
      }
      rc.putImageData(pixels,0,0);ctx.drawImage(repair,0,0);ctx.restore();
    }
    canvas.refresh();this.rotorTextures.set(texture,key);return key;
  }
  private drawEffect(g:Phaser.GameObjects.Graphics,e:Emitter,x:number,y:number,s:number,t:number,seed:number,detail:number):void {
    const size=(e.size??1)*s, phase=(t/(e.period??(6+seed*5))+seed*17)%1;
    const envelope=Math.sin(phase*Math.PI)**2, color=e.color;
    switch(e.kind) {
      case 'compass': {
        const r=size*.073;
        // Solid brass rim and ivory dial remain fixed in the scout's grip.
        g.fillStyle(0x49351c,detail).fillCircle(x,y,r);
        g.fillStyle(0xd6ab4f,detail).fillCircle(x,y,r*.91);
        g.fillStyle(0xfff0c4,detail).fillCircle(x,y,r*.77);
        for(let i=0;i<8;i++) {
          const a=i*Math.PI/4,inner=i%2===0?.51:.61;
          g.lineStyle(Math.max(.7,r*.075),0x57482d,detail);
          g.lineBetween(x+Math.sin(a)*r*inner,y-Math.cos(a)*r*inner,x+Math.sin(a)*r*.70,y-Math.cos(a)*r*.70);
        }
        const a=t*Math.PI*2/(e.period??2.4)+seed*Math.PI*2;
        const dx=Math.sin(a),dy=-Math.cos(a),nx=-dy,ny=dx;
        g.fillStyle(0xb83225,detail);
        g.fillTriangle(x+dx*r*.68,y+dy*r*.68,x+nx*r*.18,y+ny*r*.18,x-nx*r*.18,y-ny*r*.18);
        g.fillStyle(0x274c67,detail);
        g.fillTriangle(x-dx*r*.60,y-dy*r*.60,x+nx*r*.18,y+ny*r*.18,x-nx*r*.18,y-ny*r*.18);
        g.fillStyle(0xe9c46b,detail).fillCircle(x,y,r*.12);
        break;
      }
      case 'smoke': case 'steam': case 'dust': {
        const dust=e.kind==='dust';
        if(dust && phase>.32) return;
        for(let i=0;i<(dust?3:4);i++) {
          const q=dust?phase/.32:(phase+i*.25)%1;
          const alpha=Math.sin(q*Math.PI)**2*(dust?.22:.34)*detail;
          const drift=(q*.085+Math.sin(t*.6+seed*21+q*3)*q*.018)*size;
          g.fillStyle(color??(e.kind==='steam'?0xd7e1dd:0xbcc0b6),alpha);
          g.fillEllipse(x+drift+(dust?i*.013*size:0),y-q*size*(dust?.09:.36),size*(dust?.018+q*.06:.025+q*.11),size*(dust?.018+q*.045:.025+q*.075));
        }break;
      }
      case 'fire': {
        // Three tongues rise from the painted brazier, independently changing
        // height and lean. The surrounding stone never changes shape or alpha.
        const variation=e.flicker??1;
        const flicker=.8+variation*(.14*Math.sin(t*7+seed*37)+.09*Math.sin(t*13+seed*51));
        const lean=Math.sin(t*5+seed*29)*size*.014*variation;
        g.fillStyle(color??0xff9e36,.18*detail).fillEllipse(x,y,size*.115,size*.065);
        g.fillStyle(color??0xf79732,.78*detail);
        g.fillTriangle(x-size*.035,y,x+lean-size*.008,y-size*.11*flicker,x+size*.028,y);
        g.fillStyle(color??0xffcc54,.85*detail);
        g.fillTriangle(x-size*.019,y,x-lean+size*.013,y-size*.077*(1.15-flicker*.3),x+size*.025,y);
        g.fillStyle(0xffedac,.85*detail);
        g.fillTriangle(x-size*.012,y,x+lean*.4,y-size*.042*flicker,x+size*.012,y);break;
      }
      case 'afterburner': {
        // Both aircraft point down in their artwork: thrust extends up from
        // each nozzle. Keep the flame lit while varying its length and core.
        const pulse=1+.12*Math.sin(t*19+seed*37)+.07*Math.sin(t*31+seed*53);
        const length=size*.17*pulse, width=size*.023;
        const lean=size*.004*Math.sin(t*23+seed*41);
        g.fillStyle(0xffa052,.22*detail).fillEllipse(x,y-length*.18,width*3,length*.65);
        g.fillStyle(0xffa65a,.65*detail);
        g.fillTriangle(x-width,y,x+width,y,x+lean,y-length);
        g.fillStyle(0x599eff,.85*detail);
        g.fillTriangle(x-width*.8,y,x+width*.8,y,x+lean*.6,y-length*.83);
        g.fillStyle(0xe0f6ff,.95*detail);
        g.fillTriangle(x-width*.42,y,x+width*.42,y,x,y-length*.52);
        g.fillStyle(0xf3fbff,.9*detail).fillEllipse(x,y,width, width*.55);
        break;
      }
      case 'light': {
        // Slow occupancy changes, no strobing. Signals remain small and dim.
        g.fillStyle(color??0xffd7a0,(.12+envelope*.35)*detail).fillCircle(x,y,size*.028);
        g.fillStyle(color??0xffe3b3,(.3+envelope*.35)*detail).fillRect(x-size*.008,y-size*.01,size*.016,size*.02);break;
      }
      case 'beacon': {
        const a=t*.42+seed*29, reach=size*.55, spread=.18;
        g.fillStyle(0xffe6aa,.2*detail);
        g.fillTriangle(x,y,x+Math.cos(a-spread)*reach,y+Math.sin(a-spread)*reach*.45,x+Math.cos(a+spread)*reach,y+Math.sin(a+spread)*reach*.45);
        g.fillStyle(0xffe9b5,(.35+.25*Math.cos(a)**8)*detail).fillCircle(x,y,size*.018);break;
      }
      case 'water': {
        for(let i=0;i<2;i++) {
          const q=(phase+i*.5)%1;
          g.lineStyle(Math.max(.35,size*.007),0xc2ddd8,Math.sin(q*Math.PI)**2*.25*detail);
          g.strokeEllipse(x+q*size*.025,y+q*size*.025,size*(.13+q*.15),size*(.025+q*.035));
        }break;
      }
      case 'bubbles': {
        for(let i=0;i<3;i++) {const q=(phase+i*.33)%1;
          g.lineStyle(.45,0xcbe2db,Math.sin(q*Math.PI)**2*.45*detail);
          g.strokeCircle(x+Math.sin(q*5+seed*29)*size*.025,y-q*size*.2,size*(.006+q*.005));
        }break;
      }
      case 'birds': {
        if(phase>.24) return;
        const q=phase/.24,px=x+(q-.5)*size*.45,py=y-size*.17-Math.sin(q*Math.PI)*size*.05;
        g.lineStyle(Math.max(.4,size*.009),0x464e44,Math.sin(q*Math.PI)*.5*detail);
        const wing=Math.sin(t*9+seed*43)*size*.016;
        g.lineBetween(px-size*.019,py-wing,px,py);g.lineBetween(px,py,px+size*.019,py-wing);break;
      }
      case 'people': {
        if(phase>.55) return;
        const q=phase/.55,px=x+(q-.5)*size*.1,py=y+(q-.5)*size*.035;
        g.fillStyle(color??0xbca884,Math.sin(q*Math.PI)*.6*detail).fillEllipse(px,py,size*.014,size*.025);
        g.fillStyle(0x544c3e,Math.sin(q*Math.PI)*.5*detail).fillCircle(px,py-size*.012,size*.006);break;
      }
      case 'leaves': {
        if(phase>.4) return;const q=phase/.4;
        g.fillStyle(color??0xada168,Math.sin(q*Math.PI)*.45*detail);
        g.fillEllipse(x+q*size*.14,y+q*size*.08+Math.sin(q*8)*size*.012,size*.019,size*.008);break;
      }
      case 'sparks': {
        if(phase>.14) return;const q=phase/.14;
        g.fillStyle(0xe8b76c,(1-q)*.5*detail);
        for(let i=0;i<3;i++) g.fillCircle(x+(i-1)*q*size*.05,y-Math.sin(q*Math.PI)*size*.06,size*.006);break;
      }
      case 'wheel': {
        // Only the exposed left rim is visible in the isometric watermill art.
        // Paddles pass behind the mill roof; neither roof nor axle deforms.
        for(let i=0;i<12;i++) {
          const a=t*.35+seed*31+i*Math.PI/6;
          const dx=Math.cos(a)*s*.11,dy=Math.sin(a)*s*.28;
          if(Math.cos(a)>-.25) continue;
          const px=x+dx*.94-dy*.34,py=y+dx*.34+dy*.94;
          g.lineStyle(s*.014,0xc9ac77,.35*detail);
          g.lineBetween(px,py,px+s*.035,py-s*.024);
        }break;
      }
      case 'clock': {
        const a=t*Math.PI/180+seed*6;
        g.lineStyle(Math.max(.35,s*.004),0x514d3e,.65*detail);
        g.lineBetween(x,y,x+Math.sin(a)*s*.019,y-Math.cos(a)*s*.019);
        g.lineBetween(x,y,x+Math.sin(a/12+1)*s*.013,y-Math.cos(a/12+1)*s*.013);break;
      }
      case 'propeller': {
        // A restrained translucent disc suggests a turning propeller/rotor;
        // parked airframes remain fixed, and jets never get piston effects.
        const a=t*17+seed*31;
        g.lineStyle(Math.max(.35,size*.009),0xaaa99a,.22*detail);
        const dx=Math.cos(a)*size*.085,dy=Math.sin(a)*size*.02;
        g.lineBetween(x-dx,y-dy,x+dx,y+dy);break;
      }
      case 'flag': {
        const flutter=Math.sin(t*3+seed*31)*size*.011;
        g.fillStyle(color??0xc7aa75,.75*detail);
        g.fillTriangle(x,y,x+size*.055,y+size*.01+flutter,x,y+size*.025);break;
      }
    }
  }
  refreshVisibility(): void {
    this.lastDraw=-Infinity;
    this.update(0,0);
  }
  shutdown():void {
    if(this.disposed) return;this.disposed=true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE,this.tick,this);
    for (const event of [Phaser.Scenes.Events.PAUSE, Phaser.Scenes.Events.RESUME, Phaser.Scenes.Events.SLEEP, Phaser.Scenes.Events.WAKE]) {
      this.scene.events.off(event, this.resetClock);
    }
    document.removeEventListener('visibilitychange', this.resetClock);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN,this.shutdown,this);
    for(const b of this.bindings) {
      b.sprite.off(Phaser.GameObjects.Events.DESTROY,b.release);this.dropMesh(b);
      if(b.lighting)b.sprite.filters?.internal.remove(b.lighting);
    }
    this.bindings.clear();for(const g of this.layers.values()) g.destroy();this.layers.clear();
    for(const key of this.rotorTextures.values()) this.scene.textures.remove(key);
    this.rotorTextures.clear();systems.delete(this.scene);
  }
}
