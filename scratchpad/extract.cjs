const fs = require('fs');
const dir = '/home/harri/projects/Epoch/autorun-output/maritime-expansion-full-test';

const files = [
  ['cp101','checkpoint-turn-101.json'],
  ['cp201','checkpoint-turn-201.json'],
  ['cp301','checkpoint-turn-301.json'],
  ['cp401','checkpoint-turn-401.json'],
  ['cp501','checkpoint-turn-501.json'],
  ['cp588','checkpoint-turn-588.json'],
];

const NAMES = {
  nation_sweden:'Sweden', nation_hre:'HRE', nation_mongolia:'Mongolia',
  nation_england:'England', nation_china:'China', nation_india:'India',
};

function load(fn){ return JSON.parse(fs.readFileSync(dir+'/'+fn,'utf8')); }

for (const [label,fn] of files){
  let f; try { f=load(fn); } catch(e){ console.log(label,'MISSING'); continue; }
  const turn = f.turn?.currentRound;
  console.log('\n============================================================');
  console.log(`${label}  turn=${turn}  year=${f.worldYear}`);
  const wc = f.worldCouncil;
  if (wc){
    console.log(`Council: kind=${wc.organizationKind} founder=${NAMES[wc.foundingNationId]} foundingTurn=${wc.foundingTurn} status=${wc.status} members=${wc.memberNationIds.length} meetings=${wc.meetings?.length} lastMeeting=${wc.lastRegularMeetingTurn} nextMeeting=${wc.nextRegularMeetingTurn}`);
  } else { console.log('Council: none'); }

  // per-nation aggregate
  const cityByOwner = {};
  const popByOwner = {};
  for (const c of f.cities){
    cityByOwner[c.ownerId]=(cityByOwner[c.ownerId]||0)+1;
    popByOwner[c.ownerId]=(popByOwner[c.ownerId]||0)+(c.population||0);
  }
  const memberMap = {};
  if (wc) for (const m of wc.members) memberMap[m.nationId]=m;

  console.log('Nation      | cities pop  gold    infl  culture techs cnodes | DScore  =Gold  +Sci   +Cult  +Oth  | sci% cul% goldContr | DsinceMtg');
  for (const n of f.nations){
    const id=n.id; const nm=(NAMES[id]||id).padEnd(11);
    const techs=(n.researchedTechIds||[]).length;
    const cnodes=(n.unlockedCultureNodeIds||[]).length;
    const m=memberMap[id];
    const ds = m? m.diplomacyScore:0;
    const dsg=m?m.diplomacyScoreFromGold:0, dss=m?m.diplomacyScoreFromScience:0, dsc=m?m.diplomacyScoreFromCulture:0, dso=m?m.diplomacyScoreFromOther:0;
    const sp=m?m.scienceContributionPercent:'-', cp=m?m.cultureContributionPercent:'-', gc=m?m.goldContributed:'-';
    const since=m?m.diplomacyScoreSinceLastRegularMeeting:0;
    console.log(
      `${nm} | ${String(cityByOwner[id]||0).padStart(5)} ${String(popByOwner[id]||0).padStart(4)} ${String(n.gold).padStart(6)} ${String(n.influence).padStart(5)} ${String(n.culture).padStart(7)} ${String(techs).padStart(4)} ${String(cnodes).padStart(5)}  | ${String(Math.round(ds)).padStart(6)} ${String(Math.round(dsg)).padStart(5)} ${String(Math.round(dss)).padStart(5)} ${String(Math.round(dsc)).padStart(5)} ${String(Math.round(dso)).padStart(4)} | ${String(sp).padStart(3)} ${String(cp).padStart(3)} ${String(gc).padStart(8)} | ${String(Math.round(since)).padStart(6)}`
    );
  }
}
