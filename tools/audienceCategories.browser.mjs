import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const save = JSON.parse(await fs.readFile(process.argv[2] ?? 'autorun-output/latest-save.json', 'utf8'));
const browser = await chromium.launch({headless:true, executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try {
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/main.ts*', async route=> { const response=await route.fetch(); await route.fulfill({response,body:(await response.text())+'\nwindow.audienceTestGame = game;'}); });
 await page.goto('http://127.0.0.1:5187/?epochDiagnostics=1');
 await page.waitForFunction(()=>window.__epochDiagnostics?.startSavedGame,undefined,{timeout:90000});
 assert.equal((await page.evaluate(s=>window.__epochDiagnostics.startSavedGame(s),save)).ok,true);
 await page.waitForFunction(()=>window.audienceTestGame.scene.getScene('GameScene')?.leaderAudienceDialog,undefined,{timeout:90000});
 await page.evaluate(async()=>{
  const scene=window.audienceTestGame.scene.getScene('GameScene');
  window.audienceTestDialog=scene.leaderAudienceDialog;
  const { ALL_LEADERS: LEADERS }=await import('/src/data/leaders.ts');
  const state=window.__epochDiagnostics.getSaveState();
  const target=state.discovery.find(r=>r.nationA===state.humanNationId || r.nationB===state.humanNationId);
  const nationId=target.nationA===state.humanNationId?target.nationB:target.nationA;
  const leaders=Array.isArray(LEADERS)?LEADERS:Object.values(LEADERS);
  window.audienceTestDialog.open(leaders.find(l=>l.nationId===nationId).id,'war');
 });
 await page.waitForTimeout(2000);
 await page.evaluate(()=>{
  const d=window.audienceTestDialog,id=d.getCurrentLeaderId();d.close();
  const panel=window.audienceTestGame.scene.getScene('GameScene').rightSidebarPanel;
  panel.dataProvider.showLeader(id);panel.showLeaderDetails();
 });
 await page.screenshot({path:'/tmp/epoch-leader-conversations.png'});
 const entry = await page.evaluate(()=>{
  const panel=window.audienceTestGame.scene.getScene('GameScene').rightSidebarPanel;
  const labels=['Diplomacy','Economy','War & peace','Requests & promises','Gossip'];
  const buttons=labels.map(label=>panel.contentButtons.find(b=>b.row.text===label));
  if(buttons.some(b=>!b))throw new Error('Missing conversation entry');
  if(new Set(buttons.map(b=>b.hitArea.y)).size!==1)throw new Error('Entries must share one horizontal row');
  const b=buttons[2].hitArea.getBounds(),c=panel.scene.game.canvas.getBoundingClientRect();
  return {x:c.left+b.centerX*c.width/panel.scene.scale.width,y:c.top+b.centerY*c.height/panel.scene.scale.height};
 });
 await page.mouse.click(entry.x,entry.y);
 assert.equal(await page.evaluate(()=>window.audienceTestDialog.category),'war');
 assert.equal(await page.evaluate(()=>window.audienceTestDialog.isOpen()),true);
 const click=async index=>{
  const p=await page.evaluate(index=>{const d=window.audienceTestDialog,b=d.categoryButtons[index].hitArea,c=d.scene.game.canvas.getBoundingClientRect();return {x:c.left+(b.x+b.width/2)*c.width/d.scene.scale.width,y:c.top+(b.y+b.height/2)*c.height/d.scene.scale.height};},index);
  await page.mouse.click(p.x,p.y);
 };
 for (const [i,id] of ['diplomacy','economy','war','requests'].entries()) {
  await click(i); assert.equal(await page.evaluate(()=>window.audienceTestDialog.category),id);
 }
 await click(2);
 const clickAction = async text => {
  const p=await page.evaluate(text=>{const d=window.audienceTestDialog,b=d.actionList.buttons.find(b=>b.row.text===text && !b.row.disabled)?.hitArea;if(!b)return null;const c=d.scene.game.canvas.getBoundingClientRect();return {x:c.left+(b.x+b.width/2)*c.width/d.scene.scale.width,y:c.top+(b.y+b.height/2)*c.height/d.scene.scale.height};},text);
  assert.ok(p, `Expected enabled action: ${text}`);await page.mouse.click(p.x,p.y);
 };
 await clickAction('Request Joint War');
 const target = await page.evaluate(()=>window.audienceTestDialog.actionList.buttons.find(b=>!b.row.disabled)?.row.text);
 assert.ok(target);await clickAction(target);
 assert.ok(await page.evaluate(()=>window.audienceTestDialog.actionList.rows.some(r=>r.kind==='text' && r.text.startsWith('Target:'))));
 assert.ok(await page.evaluate(()=>window.audienceTestDialog.actionList.buttons.some(b=>b.row.text==='Confirm' && !b.row.disabled)));
 await page.screenshot({path:'/tmp/epoch-audience-war-proposal.png'});
 await clickAction('Change target nation');
 assert.ok(await page.evaluate(()=>window.audienceTestDialog.actionList.rows.some(r=>r.kind==='text' && r.text==='1. Select a target nation:')));
 await clickAction('Cancel');
 // Refresh must retain an existing scroll position, including repeated updates.
 await page.evaluate(()=>{ const d=window.audienceTestDialog;d.actionList.scrollBy(100);window.previousAudienceOffset=d.actionList.scrollOffset;d.refresh();d.refresh(); });
 assert.equal(await page.evaluate(()=>window.audienceTestDialog.actionList.scrollOffset),await page.evaluate(()=>window.previousAudienceOffset));
 await click(0);
 await page.screenshot({path:'/tmp/epoch-audience-categories.png'});
 await page.setViewportSize({width:1024,height:768});
 await page.waitForTimeout(300);
 await page.screenshot({path:'/tmp/epoch-audience-small.png'});
 // Category switches share one modal lifecycle and retain Gossip state.
 await page.evaluate(()=>{
  const d=window.audienceTestDialog;window.audienceLifecycleEvents=[];
  const opened=d.lifecycleHooks.onOpened,closed=d.lifecycleHooks.onClosed;
  d.lifecycleHooks.onOpened=(id)=>{window.audienceLifecycleEvents.push('open');opened?.(id);};
  d.lifecycleHooks.onClosed=(id)=>{window.audienceLifecycleEvents.push('close');closed?.(id);};
  window.sharedAudienceCamera=d.uiCamera;
 });
 await click(4);
 assert.equal(await page.evaluate(()=>window.audienceTestDialog.isOpen()),true);
 assert.equal(await page.evaluate(()=>window.audienceTestDialog.category),'gossip');
 await page.evaluate(()=>{
  const d=window.audienceTestDialog;
  const b=d.actionList.buttons.find(b=>b.row.text==='Ask' && !b.row.disabled);
  if(!b)throw new Error('Expected an available Gossip question');
  d.actionList.scrollBy(b.background.y-d.actionList.region.y-20);
 });
 await clickAction('Ask');
 assert.ok(await page.evaluate(()=>window.audienceTestDialog.gossip.model.getLatestResult()?.success));
 await page.evaluate(()=>{
  const d=window.audienceTestDialog;
  window.gossipState={item:d.gossip.model.getSelectedItem().id,result:d.gossip.model.getLatestResult(),scroll:d.actionList.getScrollOffset()};
 });
 for(const index of [0,1,2,3]) {
  await click(index);await click(4);
  assert.deepEqual(await page.evaluate(()=>{
   const d=window.audienceTestDialog;
   return {item:d.gossip.model.getSelectedItem().id,result:d.gossip.model.getLatestResult(),scroll:d.actionList.getScrollOffset()};
  }),await page.evaluate(()=>window.gossipState));
 }
 assert.equal(await page.evaluate(()=>window.audienceTestDialog.uiCamera===window.sharedAudienceCamera),true);
 assert.deepEqual(await page.evaluate(()=>window.audienceLifecycleEvents),[]);
 await page.evaluate(()=>{const d=window.audienceTestDialog;d.actionList.setScrollOffset(0);d.layout();});
 await page.screenshot({path:'/tmp/epoch-integrated-gossip.png'});
 await page.evaluate(()=>window.audienceTestDialog.close());
 assert.deepEqual(await page.evaluate(()=>window.audienceLifecycleEvents),['close']);
 // Direct Leader Details entry also opens the same chamber in Gossip.
 await page.evaluate(()=>{
  const panel=window.audienceTestGame.scene.getScene('GameScene').rightSidebarPanel;
  panel.dataProvider.arrangeGossipHandler(panel.dataProvider.getCurrentLeaderId());
 });
 assert.equal(await page.evaluate(()=>window.audienceTestDialog.category),'gossip');
 assert.equal(await page.evaluate(()=>window.audienceTestDialog.isOpen()),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: five horizontal Leader Details entries, category navigation, joint-war target/review/change/cancel clicks, refresh scroll retention, responsive screenshots and integrated Gossip execution/state/lifecycle.');
} finally {await browser.close();}
