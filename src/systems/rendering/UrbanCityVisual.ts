import Phaser from 'phaser';
import { drawCityWagons, drawCityFountain } from './CityStreetActivity';
import { drawSteamLocomotive, STATION_TRACK_Y } from './StationTrain';
import { isMapAnimationsEnabled } from '../PlayerSettings';
import type { City, SettlementStage } from '../../entities/City';
import type { TileMap } from '../TileMap';
import { getUrbanSlots } from '../UrbanDevelopment';
import { drawUrbanShore, drawWaterfrontSector, waterfrontPoint, lighthouseLight, type WaterfrontSector } from './UrbanWaterfront';

import { cityRailCorridor, drawOrganicCity, CITY_STREETS, CITY_FOUNTAIN, cityContains as contains, type CityPoint as Point } from './OrganicCityArtwork';

// Texture metadata survives scene restarts alongside Phaser's texture cache.
const smokeByTexture = new WeakMap<Phaser.Textures.Texture, Point[]>();

/** A single baked streetscape shared by cities at this map scale, plus one scene
 * animation loop. No actors, timers, pathfinding, or per-house display objects. */
export class UrbanCityVisual {
  private readonly reducedMotion = typeof matchMedia === 'undefined' ? undefined : matchMedia('(prefers-reduced-motion: reduce)');
  private readonly live = new Map<Phaser.GameObjects.Container, { ink: Phaser.GameObjects.Graphics; size: number; phase: number; land: Point[][]; smoke: Point[]; waterfront: WaterfrontSector[]; industrial: boolean; rail: ReturnType<typeof cityRailCorridor> }>();
  constructor(private readonly scene: Phaser.Scene, private readonly tileMap: TileMap) {
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
      this.live.clear();
    });
  }

  create(city: City, stage: SettlementStage = city.settlementStage): Phaser.GameObjects.Image {
    const origin = this.tileMap.tileToWorld(city.tileX, city.tileY);
    const rect = this.tileMap.getTileRect(city.tileX, city.tileY);
    const key = `urban-${stage}-${rect.width}-${rect.height}-${city.urbanDevelopment?.waterMask ?? 0}`;
    const width = Math.ceil(rect.width * 3 + 24);
    const height = Math.ceil(rect.height * 2.5 + 48);
    if (!this.scene.textures.exists(key)) {
      // Draw at twice display resolution for clean rooflines when zoomed in.
      const texture = this.scene.textures.createCanvas(key, width * 2, height * 2)!;
      const ctx = texture.context;
      ctx.scale(2, 2);
      ctx.translate(width / 2, height / 2);
      const unit = rect.width;
      const centers = [{ x: city.tileX, y: city.tileY }, ...getUrbanSlots(city)];
      const landCenters = centers.filter((_,i)=>i===0 || !getUrbanSlots(city)[i-1].water);
      const polygons = landCenters.map(c => this.tileMap.getTileOutlinePoints(c.x, c.y)
        .map(p => ({ x: p.x - origin.x, y: p.y - origin.y })));
      smokeByTexture.set(texture, drawOrganicCity(ctx, polygons, unit, stage === 'City'));
      const waterfront = this.getWaterfront(city);
      drawUrbanShore(ctx, waterfront, polygons, unit);
      for (const sector of waterfront) drawWaterfrontSector(ctx, sector, unit);
      texture.refresh();
    }
    return this.scene.add.image(0, 0, key).setDisplaySize(width, height).setData('urbanCity', true);
  }

  private getWaterfront(city: City): WaterfrontSector[] {
    const origin = this.tileMap.tileToWorld(city.tileX, city.tileY);
    return getUrbanSlots(city).filter(slot => slot.water).map(slot => {
      const p = this.tileMap.tileToWorld(slot.x, slot.y);
      return { role: slot.buildingId, center: { x: p.x-origin.x, y: p.y-origin.y },
        outline: this.tileMap.getTileOutlinePoints(slot.x, slot.y)
          .map(p => ({ x: p.x-origin.x, y: p.y-origin.y })) };
    });
  }

  attach(container: Phaser.GameObjects.Container, city: City, stage: SettlementStage = city.settlementStage): void {
    const ink = this.scene.add.graphics(); container.add(ink);
    const phase = [...city.id].reduce((sum,c) => sum + c.charCodeAt(0),0);
    const origin=this.tileMap.tileToWorld(city.tileX,city.tileY);
    const land=[{x:city.tileX,y:city.tileY},...getUrbanSlots(city).filter(s=>!s.water)].map(s=>this.tileMap.getTileOutlinePoints(s.x,s.y)
      .map(p=>({x:p.x-origin.x,y:p.y-origin.y})));
    const rect=this.tileMap.getTileRect(city.tileX,city.tileY);
    const key=`urban-${stage}-${rect.width}-${rect.height}-${city.urbanDevelopment?.waterMask ?? 0}`;
    this.live.set(container, { ink, land, industrial: stage === 'City', rail:cityRailCorridor(land,rect.width), smoke:smokeByTexture.get(this.scene.textures.get(key)) ?? [], waterfront: this.getWaterfront(city), size: this.tileMap.getTileRect(city.tileX, city.tileY).width, phase });
    container.once(Phaser.GameObjects.Events.DESTROY, () => this.live.delete(container));
  }

  private update(time: number): void {
    const view = this.scene.cameras.main.worldView;
    const animate = isMapAnimationsEnabled() && this.scene.cameras.main.zoom >= .45 && !this.reducedMotion?.matches;
    for (const [container, {ink,size,phase,land,smoke,waterfront,industrial,rail}] of this.live) {
      if (!container.visible || container.x+size*2<view.left || container.x-size*2>view.right
        || container.y+size*2<view.top || container.y-size*2>view.bottom) continue;
      ink.clear();
      if (!animate) continue;
      drawCityWagons(ink,size,time,phase,land);
      // Walkers use the exact crooked polylines baked into the streetscape.
      for(let i=0;i<14;i++) {
        const path=CITY_STREETS[i%CITY_STREETS.length];
        const t=(time/38000+phase*.013+i*.173)%2;
        const position=(t>1?2-t:t)*(path.length-1);
        const index=Math.min(path.length-2,Math.floor(position)), f=position-index;
        const x=(path[index].x+(path[index+1].x-path[index].x)*f)*size;
        const y=(path[index].y+(path[index+1].y-path[index].y)*f)*size;
        if(!land.some(p=>contains(p,{x,y})))continue;
        ink.fillStyle(0x413c32,.45);ink.fillEllipse(x+1,y+1,1.8,1);
        ink.fillStyle([0x644f40,0x9d6551,0x4f6866][i%3],.95);ink.fillRect(x,y-1.7,1.1,2);
        ink.fillStyle(0xd5b68d,1);ink.fillCircle(x+.5,y-2,.55);
      }
      if(!industrial || rail.y/size > .5) drawCityFountain(ink,size,time,CITY_FOUNTAIN);
      // Two workers per waterfront follow the same pier coordinates used by
      // the baked artwork. One batch, deterministic phases, no simulated actors.
      for (let i=0; i<waterfront.length; i++) {
        const sector=waterfront[i];
        for(let j=0;j<2;j++) {
          const t=(time/31000+phase*.017+i*.31+j*.7)%2;
          const p=waterfrontPoint(sector,.40+(t>1?2-t:t)*.66);
          ink.fillStyle(j?0x91694a:0x526b69,.9);ink.fillRect(p.x,p.y-2,1.5,2.4);
          ink.fillStyle(0xd3b68b,.95);ink.fillCircle(p.x+.7,p.y-2.3,.65);
        }
        if(sector.role==='lighthouse') {
          const p=lighthouseLight(sector,size);
          ink.fillStyle(0xffd885,.10+.07*Math.sin(time/2300+i));
          ink.fillCircle(p.x,p.y,size*.065);
        } else {
          const p=waterfrontPoint(sector,.91,size*.20);
          ink.lineStyle(.65,0xc6dace,.15+.10*Math.sin(time/1700+i));
          ink.strokeEllipse(p.x,p.y+size*.025,size*.24,size*.07);
        }
      }
      if(industrial) {
        const width=rail.right-rail.left;
        drawSteamLocomotive(ink,(x,y)=>({x:rail.left+x*width,y:rail.y+.024*size+(y-STATION_TRACK_Y)*width}),width,time/1000,(phase%97)/97,1);
      }
      // Slowly dissipating workshop plumes, drawn in the same batch.
      for(let i=0;i<smoke.length;i++) for(let j=0;j<5;j++) {
        const t=(time/7200+i*.31+j/5)%1;
        ink.fillStyle(0xe1e3d3,Math.min(1,t*6)*(1-t)*.38);
        ink.fillEllipse(smoke[i].x+(t*.055+Math.sin(t*4+i)*.012)*size,
          smoke[i].y-size*t*.24,size*(.026+t*.05),size*(.023+t*.045));
      }
    }
  }
}
