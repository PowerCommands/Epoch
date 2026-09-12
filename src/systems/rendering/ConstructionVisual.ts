import { TileType } from '../../types/map';
import type { AmbientProfile } from './AmbientProfiles';

export function constructionVisualForTerrain(type: TileType | undefined) {
  const id=type===TileType.Coast||type===TileType.Ocean?'water':'land';
  return {key:`construction_${id}`,path:`assets/sprites/construction/${id}.png`};
}

export const CONSTRUCTION_AMBIENT: Record<string,AmbientProfile> = {
  construction_land:{effects:[],parts:[{
    feature:'carpenter forearm, gripping hand and hammer striking the workbench',
    polygon:[[.750,.657],[.812,.653],[.820,.626],[.839,.626],[.858,.644],[.850,.660],[.838,.664],[.831,.683],[.767,.692],[.750,.682]],
    pivot:[.753,.675],angle:.72,rhythm:'hammer',
  }],note:'Shared land construction shell with a continuously hammering carpenter.'},
  construction_water:{effects:[{kind:'crane',x:.5,y:.542,size:1}],note:'Shared construction barge with a continuously slewing boom and hoisting cargo.'},
};
