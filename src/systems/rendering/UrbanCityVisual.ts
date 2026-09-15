import Phaser from 'phaser';
import { drawMetropolis, drawMetropolisActivity } from './MetropolisArtwork';
import { drawCityWagons, drawCityFountain } from './CityStreetActivity';
import { drawSteamLocomotive, STATION_TRACK_Y } from './StationTrain';
import { drawCitySteamWorks, drawCitySteamExhaust, drawCitySmog } from './CityIndustry';
import { isMapAnimationsEnabled } from '../PlayerSettings';
import type { City, SettlementStage } from '../../entities/City';
import type { TileMap } from '../TileMap';
import { getUrbanSlots } from '../UrbanDevelopment';
import { drawUrbanShore, drawWaterfrontSector, waterfrontPoint, lighthouseLight, type WaterfrontSector } from './UrbanWaterfront';

import { cityRailCorridor, drawOrganicCity, CITY_STREETS, CITY_FOUNTAIN, cityContains as contains, cityOccluded, type CityPoint as Point, type CityArtwork } from './OrganicCityArtwork';

// Texture metadata survives scene restarts alongside Phaser's texture cache.
const artworkByTexture = new WeakMap<Phaser.Textures.Texture, CityArtwork>();

/** A single baked streetscape shared by cities at this map scale, plus one scene
 * animation loop. No actors, timers, pathfinding, or per-house display objects. */
export class UrbanCityVisual {
  private readonly reducedMotion = typeof matchMedia === 'undefined' ? undefined : matchMedia('(prefers-reduced-motion: reduce)');
  private readonly live = new Map<Phaser.GameObjects.Container, CityArtwork & { city: City; ink: Phaser.GameObjects.Graphics; size: number; phase: number; land: Point[][]; waterfront: WaterfrontSector[]; industrial: boolean; metropolis: boolean; rail: ReturnType<typeof cityRailCorridor> }>();
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
    const key = this.textureKey(city, stage);
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
      artworkByTexture.set(texture, stage === 'Metropolis' ? drawMetropolis(ctx, polygons, unit, city.isVisuallyDamaged) : drawOrganicCity(ctx, polygons, unit, stage === 'City', city.isVisuallyDamaged));
      const waterfront = this.getWaterfront(city);
      drawUrbanShore(ctx, waterfront, polygons, unit);
      for (const sector of waterfront) drawWaterfrontSector(ctx, sector, unit);
      texture.refresh();
    }
    return this.scene.add.image(0, 0, key).setDisplaySize(width, height).setData('urbanCity', true)
      .setData('damageFires', artworkByTexture.get(this.scene.textures.get(key))?.fires ?? []);
  }

  private textureKey(city: City, stage: SettlementStage): string {
    const rect = this.tileMap.getTileRect(city.tileX, city.tileY);
    return `urban-${stage}-${rect.width}-${rect.height}-${city.urbanDevelopment?.waterMask ?? 0}${city.isVisuallyDamaged ? '-broken' : ''}`;
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
    const key=this.textureKey(city, stage);
    const artwork=artworkByTexture.get(this.scene.textures.get(key));
    this.live.set(container, { city, ink, land, industrial: stage === 'City', metropolis: stage === 'Metropolis', rail:cityRailCorridor(land,rect.width), smoke:artwork?.smoke ?? [], engines:artwork?.engines ?? [], occluders:artwork?.occluders ?? [], waterfront: this.getWaterfront(city), size: rect.width, phase });
    container.once(Phaser.GameObjects.Events.DESTROY, () => this.live.delete(container));
  }

  private update(time: number): void {
    const view = this.scene.cameras.main.worldView;
    const animate = isMapAnimationsEnabled() && this.scene.cameras.main.zoom >= .45 && !this.reducedMotion?.matches;
    for (const [container, {city,ink,size,phase,land,smoke,engines,occluders,waterfront,industrial,metropolis,rail}] of this.live) {
      if (!container.visible || container.x+size*2<view.left || container.x-size*2>view.right
        || container.y+size*2<view.top || container.y-size*2>view.bottom) continue;
      ink.clear();
      if (city.isVisuallyDamaged) continue;
      if (metropolis) {
        drawMetropolisActivity(ink,land,size,animate ? time+phase*50 : 0,phase);
        continue;
      }
      // Machinery remains visible in its resting pose when motion is disabled.
      for(const engine of engines) drawCitySteamWorks(ink,engine,size,animate?time+phase*50:0);
      if(industrial) drawCitySmog(ink,smoke,size,animate?time:0);
      if (!animate) continue;
      drawCityWagons(ink,size,time,phase,land,industrial,occluders);
      // Walkers use the exact crooked polylines baked into the streetscape.
      for(let i=0;i<(industrial?32:12);i++) {
        const path=CITY_STREETS[i%CITY_STREETS.length];
        const t=(time/38000+phase*.013+i*.173)%2;
        const position=(t>1?2-t:t)*(path.length-1);
        const index=Math.min(path.length-2,Math.floor(position)), f=position-index;
        const x=(path[index].x+(path[index+1].x-path[index].x)*f)*size;
        const y=(path[index].y+(path[index+1].y-path[index].y)*f)*size;
        if(!land.some(p=>contains(p,{x,y})) || cityOccluded({x,y:y-size*.02},occluders))continue;
        const stride=Math.sin(time/180+i)*size*.004;
        ink.fillStyle(0x1c3030,.35);ink.fillEllipse(x+size*.007,y+size*.007,size*.024,size*.013);
        ink.lineStyle(size*.004,0x263d40,1);
        ink.lineBetween(x-size*.004,y-size*.008,x-size*.004+stride,y+size*.006);
        ink.lineBetween(x+size*.004,y-size*.008,x+size*.004-stride,y+size*.006);
        ink.fillStyle((industrial?[0x234554,0x7f362d,0x394339,0xa07240]:[0x285d6b,0xae3929,0xd0a140,0x477148])[i%4],1);
        ink.fillEllipse(x,y-size*.020,size*.018,size*.027);
        ink.fillStyle(0xe0b27f,1);ink.fillCircle(x,y-size*.037,size*.007);
        ink.fillStyle(industrial?0x263c3d:0x5b3d2a,1);ink.fillEllipse(x,y-size*.042,size*.019,size*.007);
        if(industrial&&i%3===0)ink.fillRect(x-size*.006,y-size*.052,size*.012,size*.010);
      }
      if(!industrial) drawCityFountain(ink,size,time,CITY_FOUNTAIN);
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
        for(const engine of engines) drawCitySteamExhaust(ink,engine,size,time,phase);
      }
      // Slowly dissipating workshop plumes, drawn in the same batch.
      for(let i=0;i<smoke.length;i++) for(let j=0;j<6;j++) {
        const t=(time/(industrial?9200:7200)+i*.31+j/6)%1;
        ink.fillStyle(industrial?(j%2?0x52605b:0x35434a):0xd9e5df,Math.min(1,t*9)*(1-t)*(industrial?.27:.35));
        ink.fillEllipse(smoke[i].x+(t*(industrial?.18:.085)+Math.sin(t*4+i)*.012)*size,
          smoke[i].y-size*t*(industrial?.32:.24),size*(.016+t*.062),size*(.019+t*.042));
      }
    }
  }
}
