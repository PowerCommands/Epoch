/** Real GameScene/HUD/save integration. Run with a Vite server and a built-in-map save:
 * node tools/diplomaticAffairs.browser.mjs <save.json> [http://127.0.0.1:5187]
 * The input save is never changed. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const [savePath, url = 'http://127.0.0.1:5187'] = process.argv.slice(2);
assert.ok(savePath, 'Provide a built-in-map save with two surviving nations.');
const save = JSON.parse(await fs.readFile(savePath, 'utf8'));
const human = save.humanNationId;
const other = save.nations.find(n => n.id !== human && save.cities.some(c => c.ownerId === n.id))?.id;
assert.ok(other);
const round = save.turn.currentRound;
for (const n of save.nations) if (n.id === human || n.id === other) n.gold = 500;
const relation = save.diplomacy.find(r => [r.nationA,r.nationB].includes(human) && [r.nationA,r.nationB].includes(other));
assert.ok(relation); relation.state = 'PEACE'; relation.trust = 60; relation.hostility = 0;
if (!save.discovery.some(r => [r.nationA,r.nationB].includes(human) && [r.nationA,r.nationB].includes(other))) save.discovery.push({nationA:human,nationB:other});
const affair = {id:'affair_900',kind:'settlement',from:other,to:human,created:round,expires:round+5,status:'pending',amount:50,anchors:[{x:0,y:0}],cityId:save.cities.find(c => c.ownerId === human).id,cityName:'Frontier Test',line:0};
save.diplomaticAffairs = {nextId:902,affairs:[affair,{...affair,id:'affair_901',kind:'money',amount:75}],incidents:[{cityId:save.cities.find(c => c.ownerId === other).id,owner:other,neighbor:human,round,anchors:[{x:0,y:0}],used:false}],cooldowns:[],lastMoneyRound:round};
const browser = await chromium.launch({headless:true,executablePath:process.env.EPOCH_BROWSER_PATH ?? '/usr/bin/google-chrome',args:['--no-sandbox']});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(30000);
  const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  // Capture the actual shipped dialog, without introducing production diagnostics.
  await page.route('**/src/ui/hud/ProposalDialog.ts*', async route => {
    const response = await route.fetch();
    const original = await response.text();
    await route.fulfill({response,body:`${original}\n
      const affairOriginalShow = ProposalDialog.prototype.showProposal;
      ProposalDialog.prototype.showProposal = function(proposal) { window.affairTestDialog = this; return affairOriginalShow.call(this, proposal); };`});
  });
  await page.goto(`${url}/?epochDiagnostics=1`);
  await page.waitForFunction(() => window.__epochDiagnostics?.startSavedGame, undefined, {timeout:90000});
  const loaded = await page.evaluate(s => window.__epochDiagnostics.startSavedGame(s), save);
  assert.equal(loaded.ok,true,loaded.error);
  console.log('Loaded fixture; waiting for restored complaint.');
  await page.waitForFunction(() => window.affairTestDialog?.getCurrentProposalId() === 'affair_900', undefined, {timeout:90000});
  console.log('Restored complaint displayed.');
  const clickButton = async name => {
    const point = await page.evaluate(name => {
      const area = window.affairTestDialog[name].hitArea;
      const canvas = area.scene.game.canvas.getBoundingClientRect();
      return {x:canvas.left+(area.x+area.width/2)*canvas.width/area.scene.scale.width,y:canvas.top+(area.y+area.height/2)*canvas.height/area.scene.scale.height};
    }, name);
    await page.mouse.click(point.x,point.y);
  };
  assert.match(await page.evaluate(() => window.affairTestDialog.bodyText.text), /Frontier Test/);
  await page.screenshot({path:'/tmp/epoch-diplomatic-complaint.png'});
  await clickButton('compromiseButton');
  console.log('Clicked compensation; waiting for money request.');
  await page.waitForFunction(() => window.affairTestDialog.getCurrentProposalId() === 'affair_901');
  assert.equal(await page.evaluate(() => window.affairTestDialog.compromiseButton.hitArea.input.enabled), false);
  assert.equal(await page.evaluate(() => window.affairTestDialog.acceptButton.text.text), 'Send 75 gold');
  await clickButton('acceptButton');
  const after = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
  assert.equal(after.nations.find(n => n.id === human).gold,375);
  assert.equal(after.nations.find(n => n.id === other).gold,625);
  assert.deepEqual(after.diplomaticAffairs.affairs.map(a => a.status),['paid','paid']);
  assert.equal(await page.evaluate(() => window.affairTestDialog.getCurrentProposalId()),null);
  await page.evaluate(other => document.dispatchEvent(new CustomEvent('diplomacyAction', {detail:{action:'complainSettlement',targetNationId:other}})), other);
  await page.evaluate(other => document.dispatchEvent(new CustomEvent('diplomacyAction', {detail:{action:'requestPocketMoney',targetNationId:other}})), other);
  const outbound = await page.evaluate(() => window.__epochDiagnostics.getSaveState());
  assert.equal(outbound.diplomaticAffairs.affairs.find(a => a.from === human && a.kind === 'settlement').status,'promised');
  assert.equal(outbound.diplomaticAffairs.affairs.find(a => a.from === human && a.kind === 'money').status,'paid');
  assert.equal(outbound.nations.find(n => n.id === human).gold,400);
  assert.equal(outbound.nations.find(n => n.id === other).gold,600);
  assert.deepEqual(errors,[]);
  console.log('PASS: real save restoration, three-choice complaint, gold transfers, two consecutive HUD requests, hidden compromise control on money request, persisted results, human complaints and human money requests.');
} finally { await browser.close(); }
