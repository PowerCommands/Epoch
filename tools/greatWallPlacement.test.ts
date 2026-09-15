import assert from 'node:assert/strict';
import test from 'node:test';
import { City } from '../src/entities/City';
import { GREAT_WALL } from '../src/data/wonders';
import { WonderPlacementSystem } from '../src/systems/WonderPlacementSystem';
import { TileType, type MapData } from '../src/types/map';

test('Great Wall rejects water for player, AI and construction completion', () => {
  const city = new City({id:'city',name:'City',ownerId:'nation',tileX:0,tileY:0});
  const types=[TileType.Plains,TileType.Coast,TileType.Ocean,TileType.Plains];
  const map: MapData={width:4,height:1,tileSize:64,tiles:[types.map((type,x)=>({x,y:0,type,ownerId:'nation'}))]};
  city.ownedTileCoords=types.map((_,x)=>({x,y:0}));
  const system=new WonderPlacementSystem();
  assert.equal(system.startPlacement(city,GREAT_WALL.id,map),true);
  assert.deepEqual(system.getState()?.validCoords,[{x:3,y:0}]);
  assert.equal(system.selectTile(city,{x:1,y:0},map).status,'invalid');
  assert.equal(system.selectTile(city,{x:2,y:0},map).status,'invalid');
  assert.deepEqual(system.reserveFirstValidPlacement(city,GREAT_WALL,map),{tileX:3,tileY:0});
  map.tiles[0][3].type=TileType.Coast;
  assert.equal(system.finalizeReservedWonder(city.id,GREAT_WALL.id,map),null);
  assert.equal(map.tiles[0][3].wonderId,undefined);
  map.tiles[0][3].type=TileType.Plains;
  assert.equal(system.finalizeReservedWonder(city.id,GREAT_WALL.id,map)?.wonderId,GREAT_WALL.id);
});
