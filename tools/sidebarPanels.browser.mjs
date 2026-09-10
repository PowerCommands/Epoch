// Run against a local Vite server; pass a save path as the first argument.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const save=JSON.parse(await fs.readFile(process.argv[2] ?? 'autorun-output/latest-save.json','utf8'));
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.stack);});
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.panelTestGame=game;'});});
 await page.goto(`${process.env.EPOCH_BASE_URL ?? 'http://127.0.0.1:5191'}/?epochDiagnostics=1`);
 await page.waitForFunction(()=>window.__epochDiagnostics?.startSavedGame,undefined,{timeout:90000});
 await page.evaluate(s=>window.__epochDiagnostics.startSavedGame(s),save);
 await page.waitForFunction(()=>window.panelTestGame.scene.getScene('GameScene')?.rightSidebarPanel,undefined,{timeout:90000});
 await page.evaluate(async()=>{
  window.panel=window.panelTestGame.scene.getScene('GameScene').rightSidebarPanel;
  const {ALL_LEADERS}=await import('/src/data/leaders.ts');
  const leaders=Array.isArray(ALL_LEADERS)?ALL_LEADERS:Object.values(ALL_LEADERS);
  const state=window.__epochDiagnostics.getSaveState();
  const target=state.discovery.find(r=>r.nationA===state.humanNationId||r.nationB===state.humanNationId);
  const nationId=target.nationA===state.humanNationId?target.nationB:target.nationA;
  window.panel.dataProvider.showLeader(leaders.find(l=>l.nationId===nationId).id);
 });
 for(const mode of ['leader-details','world-overview','leaderboard','trading','diplomacy-graph']){
  await page.evaluate(mode=>window.panel.show(mode),mode);
  await page.waitForTimeout(700);
  await page.screenshot({path:`/tmp/epoch-panel-${mode}.png`});
  console.log(mode,await page.evaluate(()=>({width:window.panel.getPanelWidth(),height:window.panel.contentHeight,scroll:window.panel.maxScroll})));
 }

 const clickContent = async text => {
  const point=await page.evaluate(text=>{const p=window.panel,b=p.contentButtons.find(b=>b.row.text===text);if(!b)throw new Error('Button missing: '+text);return {x:p.panelContainer.x+b.hitArea.x+b.hitArea.width/2,y:p.panelContainer.y+b.hitArea.y+b.hitArea.height/2};},text);
  await page.mouse.click(point.x,point.y);
 };
 await page.evaluate(()=>window.panel.show('trading'));
 await clickContent('▸ Why trade?');
 assert.equal(await page.evaluate(()=>window.panel.expandedHelpSections.has('trading:Why trade?')),true);
 await clickContent('▾ Why trade?');
 assert.equal(await page.evaluate(()=>window.panel.expandedHelpSections.has('trading:Why trade?')),false);
 for(const [mode,field,tabs] of [
  ['leader-details','leaderDetailsTab',['details','units','cities','diplomacy','relations','economics']],
  ['leaderboard','leaderboardCategory',['domination','diplomacy','research','cultural','gon']],
  ['world-overview','worldOverviewCategory',['wonders','corporations','international']],
  ['trading','tradingTabId',['overview','buy','sell']]
 ]) {
  for(const tab of tabs){
   await page.evaluate(({mode,field,tab})=>{window.panel[field]=tab;window.panel.show(mode);}, {mode,field,tab});
   await page.waitForTimeout(150);
   console.log('Tab',mode,tab);
   assert.equal(await page.evaluate(()=>Number.isFinite(window.panel.contentHeight)),true);
  }
 }
 await page.setViewportSize({width:1024,height:768});
 for(const mode of ['leader-details','world-overview','leaderboard','trading','diplomacy-graph']){
  await page.evaluate(mode=>window.panel.show(mode),mode);
  assert.equal(await page.evaluate(()=>window.panel.panelContainer.x>=0&&window.panel.getPanelWidth()<=window.panel.scene.scale.width),true);
 }
 assert.deepEqual(errors,[]);
 console.log('Passed: all main panels and sub-tabs, help toggle clicks, finite layout, smaller viewport bounds, no browser errors.');

}finally{await browser.close();}
