import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadImage } from 'canvas';
import { ASIAN_LEADERS } from '../src/data/asianLeaders';
import { NATION_DEFINITIONS, getNationDefinitionById } from '../src/data/nations';
import { ALL_LEADERS, getDefaultLeaderByNationId, getLeadersByNationId } from '../src/data/leaders';
import { getIdeologyById } from '../src/data/ideologies';
import { getAINationalAgendaById } from '../src/data/aiNationalAgendas';
import { getAIMilitaryDoctrineById } from '../src/data/aiMilitaryDoctrines';
import { getCovertPersonalityById } from '../src/data/covertPersonalities';
import { getGamesSportById } from '../src/data/gamesOfNationsSports';
import { resolveLeaderEraStrategy } from '../src/data/aiLeaderEraStrategies';
import { LEADER_WAR_DECLARATIONS } from '../src/data/leaderWarDeclarations';
import { validateConfiguration, serializeConfiguration, deserializeConfiguration, effectiveLeader } from '../src/editor/leaderEditorModel';
import { getLeaderRoomImagePath } from '../src/utils/assetPaths';
import cityNames from '../src/data/cityNames.json';

const json=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const expected=[
 ['nation_thailand','leader_anutin_charnvirakul','Bangkok'],
 ['nation_south_korea','leader_lee_jae_myung','Seoul'],
 ['nation_north_korea','leader_kim_jong_un','Pyongyang'],
] as const;

test('three unique canonical nations integrate defaults, capitals, flags and the existing Japanese playlist',async()=>{
 assert.equal(new Set(NATION_DEFINITIONS.map(n=>n.id)).size,NATION_DEFINITIONS.length);
 assert.equal(new Set(ALL_LEADERS.map(l=>l.id)).size,ALL_LEADERS.length);
 const sounds=json('public/assets/sounds/manifest.json').playlists;
 assert.ok(sounds.nation_japan.length>0);
 const manifest=json('public/assets/data/nations-manifest.json').nations;
 for(const [nationId,leaderId,capital]of expected){
  const n=getNationDefinitionById(nationId)!;
  assert.ok(n.currencyName&&n.currencySymbol);
  assert.match(n.color,/^#[a-f0-9]{6}$/i);assert.match(n.secondaryColor,/^#[a-f0-9]{6}$/i);
  assert.equal(getDefaultLeaderByNationId(nationId)?.id,leaderId);
  assert.equal(getLeadersByNationId(nationId).filter(l=>l.isDefault).length,1);
  assert.equal(n.audioPlaylistNationId,'nation_japan');
  assert.deepEqual(sounds[nationId],sounds.nation_japan);
  assert.equal(fs.existsSync(`public/assets/sounds/${nationId}`),false);
  for(const track of sounds[nationId])assert.ok(fs.statSync(`public${track}`).size>0);
  const entry=manifest.find((e:any)=>e.nationId===nationId);
  assert.equal(entry.leaderId,leaderId);assert.equal(entry.flagImage,n.flagImage);
  const flag=await loadImage(`public${n.flagImage}`);assert.ok(flag.width>flag.height);
  const names=cityNames[nationId];assert.equal(names[0],capital);assert.ok(names.length>=20);assert.equal(new Set(names).size,names.length);
  assert.deepEqual(json('public/assets/data/city-names-manifest.json').cityNames[nationId],names);
 }
});

for(const l of ASIAN_LEADERS)test(`${l.name}: valid AI profiles, editable configuration, dialogue and image assets`,async()=>{
 const {id,nationId,isDefault,...patch}=l;
 assert.deepEqual(validateConfiguration({version:1,leaders:{[id]:patch}}),[]);
 assert.equal(getIdeologyById(l.ideologyId).id,l.ideologyId);
 assert.equal(getAINationalAgendaById(l.aiNationalAgendaId).id,l.aiNationalAgendaId);
 assert.equal(getAIMilitaryDoctrineById(l.aiMilitaryDoctrineId).id,l.aiMilitaryDoctrineId);
 assert.equal(getCovertPersonalityById(l.covertPersonalityId).id,l.covertPersonalityId);
 for(const era of ['ancient','classical','medieval','renaissance','industrial','modern'] as const)assert.ok(resolveLeaderEraStrategy(id,era).id);
 assert.equal(getGamesSportById(l.gamesOfNationsPreferences.traditionalFavourite).category,'traditional');
 assert.equal(getGamesSportById(l.gamesOfNationsPreferences.additionalFavourite).category,'additional');
 assert.equal(Object.keys(l.diplomacyFlavor!).length,7);
 const edited=deserializeConfiguration(serializeConfiguration({version:1,leaders:{[id]:{aiPersonality:{economyBias:12}}}}));
 assert.equal(effectiveLeader(edited,id).aiPersonality.economyBias,12);
 const phrases=LEADER_WAR_DECLARATIONS[id];assert.ok(phrases);
 for(const reason of ['conquest','hostility','threat','ideological','ambition']as const)assert.equal(new Set(phrases[reason]).size,2);
 const portrait=await loadImage(`public${l.image}`);assert.deepEqual([portrait.width,portrait.height],[416,416]);
 const room=fs.readFileSync(`public${getLeaderRoomImagePath(l.image)}`);assert.equal(room.toString('ascii',0,4),'RIFF');assert.equal(room.toString('ascii',8,12),'WEBP');
 assert.ok(fs.readFileSync('public/editor/epoch-leader-editor.js','utf8').includes(id));
 if(process.env.EPOCH_VERIFY_BUILD)for(const path of [l.image,getLeaderRoomImagePath(l.image),getNationDefinitionById(nationId)!.flagImage!])assert.deepEqual(fs.readFileSync(`public${path}`),fs.readFileSync(`dist${path}`));
});
