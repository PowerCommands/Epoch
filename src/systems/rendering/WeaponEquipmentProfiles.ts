import type { AmbientProfile, ArtPart, Point } from './AmbientProfiles';

function wheel(x:number,y:number,rx:number,ry:number): ArtPart {
  return {feature:'original tire and wheel face rotating around its fixed axle',
    polygon:Array.from({length:32},(_,i)=>{const a=i*Math.PI/16;return [x+Math.cos(a)*rx,y+Math.sin(a)*ry] as Point;}),
    pivot:[x,y],angle:0,rhythm:'machine',spin:{period:1.8,aspect:rx/ry}};
}
function barrel(polygon:Point[],muzzle:Point,direction:Point,travel=.035): ArtPart {
  return {feature:'complete exposed gun barrel sliding backward along its bore',polygon,pivot:muzzle,
    angle:0,dx:-direction[0]*travel,dy:-direction[1]*travel,rhythm:'recoil'};
}

/** Cutouts follow the original weapon art; wheels, supports and tripod stay put. */
export const WEAPON_EQUIPMENT_PROFILES: Record<string, AmbientProfile> = {
  catapult: {
    effects:[],
    parts:[{
      feature:'exposed throwing arm and complete stone cup swinging above the frame bearing',
      polygon:[[.655,.288],[.735,.235],[.735,.09],
        [1,.09],[1,.32],[.845,.32],[.690,.40],[.654,.378]],
      pivot:[.655,.352],angle:-1.35,rhythm:'throw',
    }],
    shots:[{kind:'stone',part:0,muzzle:[.859,.181],direction:[-.85,-.53]}],
    note:'Exposed throwing arm winds back, swings forward and releases a stone on an independent ballistic arc; wheels and frame remain grounded.',
  },
  machine_gun: {
    effects:[],
    parts:[{
      feature:'barrel and receiver recoiling above the fixed tripod bearing',
      polygon:[[.052,.063],[.113,.066],[.341,.238],[.473,.301],
        [.505,.278],[.536,.297],[.537,.342],[.691,.427],[.742,.439],
        [.747,.352],[.771,.353],[.770,.455],[.942,.563],[.975,.573],
        [.981,.626],[.957,.776],[.909,.810],[.861,.795],[.853,.739],
        [.630,.601],[.590,.589],[.536,.548],[.476,.518],[.422,.485],
        [.421,.442],[.340,.390],[.283,.320],[.069,.126]],
      pivot:[.49,.52],angle:-.012,dx:.023,dy:.016,rhythm:'burst',
      repairs:[{polygon:[[.424,.45],[.535,.47],[.58,.55],[.53,.59],[.42,.52]],offset:[0,.045]}],
    }],
    shots:[{kind:'burst',part:0,muzzle:[.076,.093],direction:[-.80,-.60]}],
    note:'Four-round salvos with synchronized receiver recoil, orange-white muzzle flames, smoke and flying tracers; tripod stays fixed.',
  },
  cannon: {
    effects:[],
    parts:[barrel([[.055,.438],[.103,.421],[.125,.43],[.327,.31],[.465,.232],
      [.497,.194],[.554,.182],[.592,.177],[.64,.151],[.716,.148],[.744,.177],
      [.762,.176],[.786,.198],[.784,.226],[.761,.249],[.738,.329],[.668,.365],
      [.567,.37],[.494,.399],[.363,.468],[.214,.548],[.182,.585],[.149,.615],
      [.109,.61],[.079,.576]], [.119,.529],[-.87,.49])],
    shots:[{kind:'shell',part:0,muzzle:[.119,.529],direction:[-.87,.49]}],
    note:'Cannon fires a bright muzzle blast and traveling shell; barrel recoils backward and returns over the grounded carriage.',
  },
  anti_aircraft_gun: {
    effects:[],
    parts:[barrel([[.42,.414],[.476,.354],[.503,.317],[.559,.284],[.610,.268],
      [.651,.218],[.681,.216],[.884,.064],[.918,.048],[.949,.061],[.953,.088],
      [.921,.126],[.728,.277],[.701,.316],[.655,.333],[.605,.38],[.565,.425],
      [.518,.46],[.485,.492],[.438,.470]], [.921,.089],[.79,-.61],.041)],
    shots:[{kind:'shell',part:0,muzzle:[.921,.089],direction:[.79,-.61]}],
    note:'Elevated barrel fires upward with muzzle flame, shell and backward recoil; shield, wheels and carriage remain fixed.',
  },
  gatling_gun: {
    effects:[],
    parts:[{...barrel([[.183,.049],[.242,.037],[.291,.081],[.405,.176],
      [.472,.192],[.534,.232],[.563,.279],[.535,.343],[.490,.366],
      [.425,.323],[.395,.296],[.223,.164],[.190,.125]],
      [.224,.086],[-.77,-.64],.024),rhythm:'burst'}],
    shots:[{kind:'burst',part:0,muzzle:[.224,.086],direction:[-.77,-.64]}],
    note:'The pictured wheeled Gatling fires repeated salvos with muzzle flames, tracers and backward barrel recoil.',
  },
  landship: {
    effects:[{kind:'smoke',x:.465,y:.255,size:.25,period:7}],
    parts:[barrel([[.664,.443],[.701,.448],[.744,.48],[.762,.513],
      [.743,.537],[.712,.512],[.673,.488]], [.742,.512],[.83,.56],.025),
      wheel(.225,.555,.047,.081),wheel(.506,.749,.056,.083)],
    shots:[{kind:'shell',part:0,muzzle:[.742,.512],direction:[.83,.56]}],
    note:'Visible wheel faces rotate continuously; the roof gun fires shells with muzzle blast and barrel recoil.',
  },
  tank: {
    effects:[{kind:'smoke',x:.71,y:.62,size:.25,period:17}],
    parts:[barrel([[.019,.416],[.343,.299],[.357,.275],[.397,.267],[.421,.287],
      [.433,.326],[.405,.36],[.363,.36],[.093,.487],[.048,.504],[.020,.472]],
      [.055,.454],[-.93,.37],.031)],
    shots:[{kind:'shell',part:0,muzzle:[.055,.454],direction:[-.93,.37]}],
    tracks:[{path:[[.368,.843],[.869,.561],[.924,.527],[.933,.563],[.884,.659],
      [.468,.930],[.413,.921],[.381,.884]],width:.016,links:36,period:2.5},
      {path:[[.089,.554],[.13,.598],[.326,.812],[.338,.844],[.305,.824],[.116,.616]],width:.013,links:20,period:2.5}],
    note:'Tread links circulate around the visible track belts; main gun fires a shell with muzzle flame and axial recoil.',
  },
  modern_armor: {
    effects:[{kind:'smoke',x:.76,y:.44,size:.25,period:17}],
    parts:[barrel([[.042,.373],[.122,.371],[.247,.392],[.29,.394],[.402,.412],
      [.449,.411],[.453,.452],[.397,.453],[.284,.438],[.242,.44],[.12,.416],[.044,.414]],
      [.062,.394],[-.997,-.077],.032)],
    shots:[{kind:'shell',part:0,muzzle:[.062,.394],direction:[-.997,-.077]}],
    tracks:[{path:[[.443,.739],[.852,.503],[.905,.462],[.904,.505],[.843,.600],
      [.540,.774],[.484,.797],[.453,.779]],width:.016,links:31,period:2.4},
      {path:[[.224,.596],[.282,.648],[.377,.710],[.387,.730],[.355,.711],[.236,.630]],width:.013,links:17,period:2.4}],
    note:'Continuous moving tread links on both visible belts; cannon fires traveling shells with a bright muzzle flash and backward barrel recoil.',
  },
};
