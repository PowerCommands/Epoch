import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { transformSync } from 'esbuild';

// Exercise the shipped standalone dialog and its actual field/save functions,
// without loading a scenario, requesting assets or starting the game renderer.
const html = readFileSync('public/editor.html', 'utf8');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME ?? (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined) });
try {
  const page = await browser.newPage();
  await page.setContent(html.slice(html.indexOf('<div id="historical-event-overlay"'), html.indexOf('<div id="magic-wand-panel"')));
  await page.addScriptTag({ content: `
    var historicalEventDialogDraft = {id:'test',type:'worldWar',name:'',conflicts:[]};
    var scenarioDetailsHistoricalEventsDraft = [];
    var historicalEventEditingIndex = null;
    var TURNING_POINT_EVENT_DEFINITIONS = {luckyLoser:{name:'Lucky Loser'}};
    function structuredCloneCompat(value) { return structuredClone(value); }
    function closeHistoricalEventDialog() {}
    function renderScenarioHistoricalEventsList() {}
    ${html.slice(html.indexOf('const HISTORICAL_WORLD_EVENT_FIELDS ='), html.indexOf('function openHistoricalEventDialog('))}
    ${html.slice(html.indexOf('function saveHistoricalEventDialog()'), html.indexOf('function openScenarioDetails()'))}
  ` });
  const expected = {
    stockMarketCrash: {goldReductionPercent:'50',happinessPenalty:'-20',duration:'25'},
    famine: {foodReductionPercent:'50',diplomaticScoreReward:'100',duration:'25'},
    pandemic: {happinessPenalty:'-20',duration:'25'},
    energyCrisis: {energyPriceIncreasePercent:'25',duration:'25'},
  };
  for (const [type, fields] of Object.entries(expected)) {
    await page.selectOption('#he-type', type);
    await page.evaluate(() => updateHistoricalEventTypeFields());
    assert.equal(await page.locator('#he-conflicts-section').isVisible(),false);
    assert.equal(await page.locator('#he-end-condition-section').isVisible(),false);
    const actual=await page.locator('#he-world-parameters input').evaluateAll(inputs=>Object.fromEntries(inputs.map(input=>[input.id.replace('he-param-',''),input.value])));
    assert.deepEqual(actual,fields);
  }
  await page.selectOption('#he-type','famine');
  await page.evaluate(()=>updateHistoricalEventTypeFields());
  await page.fill('#he-start-year','2020');
  await page.locator('#he-start-month').evaluate(select=>select.add(new Option('January','1',true,true)));
  await page.fill('#he-param-foodReductionPercent','65');await page.fill('#he-param-duration','17');
  await page.evaluate(()=>saveHistoricalEventDialog());
  const saved=await page.evaluate(()=>scenarioDetailsHistoricalEventsDraft[0]);
  assert.equal(saved.type,'famine');assert.equal(saved.foodReductionPercent,65);assert.equal(saved.duration,17);assert.equal(saved.diplomaticScoreReward,100);
  assert.equal('conflicts' in saved,false);assert.equal('happinessPenalty' in saved,false);
  await page.selectOption('#he-type','worldWar');await page.evaluate(()=>updateHistoricalEventTypeFields());
  assert.equal(await page.locator('#he-conflicts-section').isVisible(),true);
  assert.equal(await page.locator('#he-world-parameters input').count(),0);
  console.log('Historical event editor: defaults, relevant controls, custom save and World War compatibility passed.');
  const councilScript=transformSync(readFileSync('src/ui/hud/WorldCouncilOverviewDialog.ts','utf8'),{loader:'ts',format:'iife',globalName:'CouncilUI'}).code;
  await page.addScriptTag({content:councilScript});
  await page.evaluate(()=>{
    window.aidPercent=0;
    const dialog=new CouncilUI.WorldCouncilOverviewDialog();
    dialog.show({organizationName:'World Council',status:'active',foundingCityName:'Capital',foundingNationName:'Nation',constructionTurnsRemaining:0,diplomacyScoreThreshold:1000,nextRegularMeetingTurn:50,currentTurn:10,canHumanLeave:false,members:[],enactedResolutions:[],meetings:[],
      humanitarianEmergencies:[{name:'Recipient',remainingTurns:25,percent:0,production:100,contributed:0,score:0,otherPercent:0,setPercent:percent=>{window.aidPercent=percent;return percent;}}]});
  });
  const choice=page.locator('#epoch-world-council-overview select');
  assert.equal(await choice.inputValue(),'0');
  await choice.selectOption('10');assert.equal(await page.evaluate(()=>window.aidPercent),10);
  assert.match(await page.locator('#epoch-world-council-overview').innerText(),/10.0 Food per turn.*90.0 retained/);
  await choice.selectOption('0');assert.equal(await page.evaluate(()=>window.aidPercent),0);
  console.log('Council humanitarian aid: decline, percentage changes and economic consequence passed.');
} finally { await browser.close(); }
