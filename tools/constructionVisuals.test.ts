import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { TileType } from '../src/types/map';
import { constructionVisualForTerrain, CONSTRUCTION_AMBIENT } from '../src/systems/rendering/ConstructionVisual';
import { ambientMotion } from '../src/systems/rendering/AmbientProfiles';

test('only coast and ocean choose the crane barge; both shared assets exist',()=>{
  for(const type of Object.values(TileType)) {
    const view=constructionVisualForTerrain(type);
    assert.equal(view.key,type===TileType.Coast||type===TileType.Ocean?'construction_water':'construction_land');
    assert.ok(existsSync('public/'+view.path));
    assert.ok(CONSTRUCTION_AMBIENT[view.key]);
  }
});
test('carpenter hammering loops continuously without an idle interval',()=>{
  const values=Array.from({length:100},(_,i)=>ambientMotion(i*.02,.3,'hammer'));
  assert.ok(Math.min(...values)<.05&&Math.max(...values)>.95);
  for(let i=0;i<values.length-1;i++)assert.notEqual(values[i],values[i+1]);
  assert.ok(Math.abs(ambientMotion(.27,.3,'hammer')-ambientMotion(.27+Math.PI/4,.3,'hammer'))<1e-10);
});
