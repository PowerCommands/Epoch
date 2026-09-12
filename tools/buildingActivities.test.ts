import assert from 'node:assert/strict';
import test from 'node:test';
import { stoneCranePose } from '../src/systems/rendering/BuildingActivities';
test('stone crane raises first, slews half a turn, then lowers before repeating',()=>{
  assert.deepEqual(stoneCranePose(0,0),{angle:0,lift:0});
  assert.deepEqual(stoneCranePose(2,0),{angle:0,lift:1});
  assert.deepEqual(stoneCranePose(4,0),{angle:Math.PI,lift:1});
  assert.deepEqual(stoneCranePose(6,0),{angle:Math.PI,lift:0});
  assert.deepEqual(stoneCranePose(8,0),{angle:Math.PI,lift:1});
  assert.deepEqual(stoneCranePose(10,0),{angle:Math.PI*2,lift:1});
  assert.deepEqual(stoneCranePose(12,0),stoneCranePose(0,0));
});
