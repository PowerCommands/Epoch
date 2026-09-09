import { getLeaderConfiguration } from './leaderConfiguration';
import type { WarDeclarationPhrases, WarDeclarationReason } from '../types/warDeclaration';

/**
 * Short, leader-specific lines used only after the AI has independently chosen
 * war. Keeping them in one flavor catalog makes coverage auditable and avoids
 * leader checks in diplomacy code.
 */
export const LEADER_WAR_DECLARATIONS: Readonly<Record<string, WarDeclarationPhrases>> = {
  leader_ruhollah_khomeini: {
    "conquest": [
        "Iran will secure the ground from which our independence has been challenged.",
        "This advance will deny foreign powers another instrument of pressure against us."
    ],
    "hostility": [
        "Your repeated coercion has made resistance our duty. We will endure what follows.",
        "You sought obedience through humiliation. Iran will answer with sustained resistance."
    ],
    "threat": [
        "Your forces threaten our country. We will resist before you can dictate our future.",
        "We have watched your preparations. Our people will not wait helplessly for an attack."
    ],
    "ideological": [
        "You would make our convictions subject to your approval. We reject that claim by force.",
        "Our revolution will not survive by yielding whenever its principles are challenged."
    ],
    "ambition": [
        "Iran must have the strength to resist interference throughout this region. We now act.",
        "We will break the position from which you seek to confine our influence."
    ]
},
  leader_saddam_hussein: {
    "conquest": [
        "Iraq has the strength to take these positions, and we will use it.",
        "Your weakness has opened the frontier. Iraq’s army will seize the advantage."
    ],
    "hostility": [
        "Your defiance has gone unanswered long enough. Iraq will settle this contest by force.",
        "You have challenged our standing in the region. Our army will provide the answer."
    ],
    "threat": [
        "We will strike your forces before they can turn their preparations against Iraq.",
        "Your military buildup threatens our position. We will not grant you more time."
    ],
    "ideological": [
        "Iraq will not accept an order designed to subordinate our nation. We will fight it.",
        "You challenge the authority and national purpose of our state. We will break that challenge."
    ],
    "ambition": [
        "Iraq’s place in this region will be established by strength. The campaign begins.",
        "The resources and position before us will shape the region’s future. Iraq will command them."
    ]
},
  leader_cleopatra_vii: {
    "conquest": [
        "Egypt’s rivals are divided, and the moment will not return. Our forces will advance.",
        "I have secured the support this campaign requires. Egypt will now claim its advantage."
    ],
    "hostility": [
        "You have mistaken patient negotiation for dependence. Egypt has prepared an answer.",
        "Your insults have cost you partners. You will now discover the consequence."
    ],
    "threat": [
        "I will not leave Egypt’s survival to the goodwill of an army at our frontier.",
        "Your preparations threaten the kingdom. Our alliances and forces will now act together."
    ],
    "ideological": [
        "You would reduce Egypt to a voice at another court. Our kingdom will defend its own authority.",
        "Egypt’s traditions and learning will not flourish at your sufferance. We will resist your demands."
    ],
    "ambition": [
        "Power has shifted, and Egypt must act while it can still shape the settlement.",
        "The future of my kingdom cannot rest on promises from stronger courts. We will secure it ourselves."
    ]
},
  leader_abdel_fattah_el_sisi: {
    "conquest": [
        "Egypt will secure the positions necessary to restore control along this frontier.",
        "This operation has a defined objective: remove the ground from which our stability is threatened."
    ],
    "hostility": [
        "Your repeated interference has undermined every attempt at a stable relationship. Egypt will respond.",
        "We offered practical arrangements. Your continuing pressure now requires military action."
    ],
    "threat": [
        "The threat to Egypt’s security has become immediate. Our armed forces will move.",
        "We cannot permit instability at the frontier to become a danger within Egypt."
    ],
    "ideological": [
        "You seek to undermine the authority that holds our state together. Egypt will resist.",
        "Our national institutions will not be dismantled under foreign pressure. We are prepared to fight."
    ],
    "ambition": [
        "Egypt must recover the initiative needed for a lasting regional settlement.",
        "We will establish a position from which our security and development can proceed."
    ]
},
  leader_benjamin_netanyahu: {
    "conquest": [
        "We will take the positions needed to deny your forces a continuing military advantage.",
        "This operation will secure defensible ground. Its value is measured in security."
    ],
    "hostility": [
        "Your repeated provocations have made the existing arrangement untenable. We will act.",
        "You have used restraint as an opportunity to increase pressure. That calculation ends now."
    ],
    "threat": [
        "Our assessment is clear: your preparations present a credible threat. We will act before it matures.",
        "We will not wait for the first strike to confirm what your deployment already tells us."
    ],
    "ideological": [
        "Israel’s right to make its own security decisions is not subject to your veto. We will defend it.",
        "You demand submission where we require security. Our forces will resist that demand."
    ],
    "ambition": [
        "We must change the strategic position that leaves our country exposed. The operation begins.",
        "Israel will establish the deterrence that words alone have failed to secure."
    ]
},
  leader_recep_tayyip_erdogan: {
    "conquest": [
        "The balance now favors Turkey. We will secure the positions our interests require.",
        "Turkey will not leave this opportunity to powers that disregard our stake in the region."
    ],
    "hostility": [
        "You cannot repeatedly challenge Turkey and expect our cooperation to continue unchanged.",
        "We have made our objections clear. Your refusal to take them seriously now has consequences."
    ],
    "threat": [
        "Your deployment threatens our frontier and our regional position. Turkey will respond.",
        "We will act before this military pressure becomes a permanent constraint on Turkey."
    ],
    "ideological": [
        "Turkey’s sovereign choices cannot be dictated from abroad. We will defend that independence.",
        "You seek a regional order in which Turkey must obey. We will contest it by force."
    ],
    "ambition": [
        "Turkey intends to shape this region’s future. Our forces will now support that purpose.",
        "Diplomatic bargaining has reached its limit. We will change the balance on the ground."
    ]
},
  leader_mohammed_bin_salman: {
    "conquest": [
        "We will secure the corridor on which our trade and investment depend.",
        "Our forces will take the positions needed to protect the kingdom’s economic interests."
    ],
    "hostility": [
        "You have repeatedly damaged the confidence on which cooperation rests. Economic measures have failed.",
        "The costs of your interference can no longer be contained through commercial pressure alone."
    ],
    "threat": [
        "Your forces threaten our infrastructure and security. We will remove that danger.",
        "The kingdom cannot build its future under the threat you have created. We will act."
    ],
    "ideological": [
        "Our development will not be subject to your political demands. We will defend our freedom to pursue it.",
        "You seek to dictate the kingdom’s path. We will commit the means necessary to resist."
    ],
    "ambition": [
        "We will use our strength to establish the security that our future investments require.",
        "The kingdom needs a stable regional position. This operation will secure the terms for one."
    ]
},

  leader_alexander_stubb: {
    "conquest": [
      "Finland will secure the positions needed for a defensible settlement. Our objective is lasting security, and our advance must serve it.",
      "Negotiations have failed to secure this frontier. We are committing forces to a limited objective and remain ready for a durable settlement."
    ],
    "hostility": [
      "You have repeatedly used pressure where we offered cooperation. Finland will now meet your coercion with force and sustained resolve.",
      "You treated our willingness to talk as permission to threaten us. That calculation has failed. Finland and its partners will resist."
    ],
    "threat": [
      "Your military pressure has become a direct danger to our security. Finland is prepared, our commitments stand, and we will act.",
      "Our partners will not face this threat alone. Diplomacy and deterrence have failed; Finland will now uphold its commitments by force."
    ],
    "ideological": [
      "An international order built on coercion cannot keep our nations secure. Finland will defend the right to choose our own future.",
      "Cooperation requires sovereign nations and commitments that mean something. Your attempt to impose obedience leaves us prepared to fight."
    ],
    "ambition": [
      "Finland must be able to guarantee its own security. We undertake this operation with limited aims and a responsibility to secure the peace.",
      "Our purpose is a settlement our people and partners can depend on. With peaceful arrangements exhausted, we will commit the force needed to achieve it."
    ]
  },
  leader_justin_trudeau: {
    "conquest": [
      "Canada will secure the ground needed to protect our people and partners. Our objective must remain a lasting peace.",
      "This operation carries a serious responsibility. Canada will use its advantage to establish security and seek a settlement."
    ],
    "hostility": [
      "Repeated attacks on trust have left our people exposed. Canada will now answer with the strength of its commitments.",
      "We pursued cooperation, but you have made confrontation your policy. Canada and its partners will respond."
    ],
    "threat": [
      "Your military preparations threaten our security. Canada will act before that danger becomes an attack on our people.",
      "Our allies cannot face your threats alone. Canada will stand beside them and meet this danger together."
    ],
    "ideological": [
      "An order built on coercion cannot protect the freedoms our people share. Canada will oppose it with resolve.",
      "Sovereignty and cooperation require nations willing to defend them. Canada accepts that responsibility today."
    ],
    "ambition": [
      "Canada must be able to uphold the commitments it makes. We are taking military action to secure that ability.",
      "This is a grave use of Canadian power. We will pursue a limited objective and a durable peace."
    ]
  },
  leader_claudia_sheinbaum_pardo: {
    "conquest": [
      "Mexico will secure this position to protect its people. Military success must serve security and national development.",
      "We are committing forces to secure our frontier. Our purpose is a settlement that respects Mexico’s independence."
    ],
    "hostility": [
      "You have repeatedly undermined our security and rejected a respectful settlement. Mexico will now defend its interests by force.",
      "Our willingness to negotiate was real. Your continued coercion has made a military response necessary."
    ],
    "threat": [
      "Your forces threaten the communities we are responsible for protecting. Mexico will act to remove that danger.",
      "We will not leave our national development at the mercy of your military pressure. Mexico is prepared to resist."
    ],
    "ideological": [
      "No foreign power may decide how our people govern themselves. Mexico will defend that principle with force.",
      "Your demands deny the equality and independence of our nation. Mexico cannot accept them and will resist."
    ],
    "ambition": [
      "Mexico must have the strength to protect its own decisions. Our forces will act to secure that independence.",
      "Our future requires secure communities and freedom from coercion. We are committing our strength to that purpose."
    ]
  },
  leader_javier_milei: {
    "conquest": [
      "The balance gives Argentina a decisive advantage. We will secure this position and insist on terms that justify the cost.",
      "You have left a strategic opening. Argentina will take it, with clear objectives and no appetite for an endless campaign."
    ],
    "hostility": [
      "Your obstruction now carries a price that negotiation has failed to remove. Argentina will answer with force.",
      "You have treated every agreement as an invitation to demand more. That calculation ends here. We are at war."
    ],
    "threat": [
      "Your military pressure threatens our freedom to trade and govern. We will remove that threat before the cost grows.",
      "Argentina will not finance its own submission through delay. Your preparations demand decisive action now."
    ],
    "ideological": [
      "Your demand for obedience is incompatible with our freedom of action. Argentina will resist it by force.",
      "We reject a political order that lets you dictate our choices. Our independence will be defended."
    ],
    "ambition": [
      "A favorable moment means little without the will to act. Argentina will commit its strength and demand a concrete result.",
      "I have weighed the risks. Argentina will act now to secure its freedom of action and bargaining position."
    ]
  },
  leader_volodymyr_zelenskyy: {
    "conquest": [
      "Ukraine will secure the positions from which our people can be threatened. Our objective is a homeland that can live in peace.",
      "We are advancing to remove the danger to our cities. Every military objective must serve our people’s security."
    ],
    "hostility": [
      "You have answered our efforts for peace with continued coercion. Ukraine will fight to end it.",
      "We have endured your hostility and sought dependable guarantees. Now our armed forces must secure what your words would not."
    ],
    "threat": [
      "Your forces threaten our national survival. Ukraine will meet that danger with every prepared unit and every dependable partner.",
      "We will not wait for your threats to become the destruction of our cities. Ukraine is ready, and Ukraine will resist."
    ],
    "ideological": [
      "Our people have the right to choose their own future. We will fight any power that tries to take that right away.",
      "An order that denies our sovereignty offers no peace we can accept. Ukraine will oppose it with force."
    ],
    "ambition": [
      "Ukraine must be strong enough to secure its own future. We are acting so that no aggressor can decide it for us.",
      "Our determination is matched by preparation and partnerships. We will use that strength to secure a peace that can last."
    ]
  },
  leader_henry_v: {
    conquest: ['Your defenses invite a campaign, and I intend to finish it decisively.', 'The field is prepared and your realm lies before us. England marches.'],
    hostility: ['Your offenses have exhausted the patience of my crown. We shall answer them in battle.', 'You have chosen defiance at every turn. Let arms now settle what words could not.'],
    threat: ['Your growing host leaves England no safe course but action. We strike before you are ready.', 'I will not wait while your armies gather against us. The danger ends now.'],
    ideological: ['Your rule stands against the order we defend. England will oppose it by force.', 'Our principles can no longer share the same peace. The sword must judge between them.'],
    ambition: ['A king who hesitates loses both honor and opportunity. England advances.', 'History rewards resolve, not caution. I claim this hour for England.'],
  },
  leader_charles_vii: {
    conquest: ['Your weakness threatens the balance of the realm. France will restore order under its own banner.', 'The lands between us require firmer stewardship. France will provide it.'],
    hostility: ['Every avenue of reconciliation has been spoiled by your conduct. France now takes up arms.', 'You have turned courtesy into contempt and patience into folly. This quarrel ends in war.'],
    threat: ['Your preparations leave my kingdom exposed. I act now because delay would endanger France.', 'France cannot remain still while your power gathers at our frontier. Necessity compels us.'],
    ideological: ['The order you impose is incompatible with the dignity of our realm. France will resist it.', 'Your principles corrupt peace itself. We must oppose them before they spread further.'],
    ambition: ['France must recover the authority that caution has surrendered. Our armies will secure it.', 'The crown cannot be restored by ceremony alone. France now asserts its place by force.'],
  },
  leader_charles_de_gaulle: {
    conquest: ['France does not seek dominion, but this position can no longer remain in hands that endanger our independence.', 'Strategic necessity requires us to secure this ground. France will take it and answer for the decision herself.'],
    hostility: ['You have answered French independence with pressure and contempt. France will now answer with arms.', 'Every attempt at honorable relations has met another demand for submission. France refuses, and France fights.'],
    threat: ['Your military preparations leave France no safe future in waiting. We shall resist before resistance becomes impossible.', 'No foreign power will be permitted to decide France’s fate through intimidation. We act now to remain free.'],
    ideological: ['Your system demands obedience where France insists upon sovereignty. Between those principles, there can be no surrender.', 'France cannot accept an order in which nations exist only by another power’s permission. We will oppose it.'],
    ambition: ['France must stand among the powers that shape events, not among those who merely endure them. We shall act.', 'National independence requires the will to use national strength. France now demonstrates that will.'],
  },
  leader_sigismund: {
    conquest: ['Your lands have become a danger to imperial order. I will bring them beneath firmer authority.', 'Where your rule has failed, imperial power must now prevail.'],
    hostility: ['Council and compromise have answered every grievance but yours. You leave the Empire only war.', 'You have rejected settlement and insulted imperial authority. The matter passes from council to battlefield.'],
    threat: ['Your power now imperils every crown around you. The Empire will act before all are placed at your mercy.', 'I would prefer judgment in council, but your armies permit no delay. We go to war.'],
    ideological: ['Your doctrine divides the order I am sworn to preserve. It will be opposed by force.', 'No council can reconcile principles that deny the foundations of the Empire. War is upon us.'],
    ambition: ['An emperor must sometimes command where diplomacy cannot persuade. I will enlarge the peace by victory.', 'The moment demands imperial resolve. Our banners will carry authority beyond these borders.'],
  },
  leader_gustav_vasa: {
    conquest: ['Your frontier is exposed, and Sweden will not leave such an advantage unused.', 'Sweden needs secure borders, not promises. We will take the ground required to defend them.'],
    hostility: ['You have answered honest dealings with provocation. Sweden now answers with steel.', 'Our patience was offered freely and abused repeatedly. There will be no further warning.'],
    threat: ['Your strength grows too near Sweden for comfort. We will break the danger before it closes around us.', 'I built Sweden to be independent, not vulnerable. Your preparations force our hand.'],
    ideological: ['The rule you advance would make free nations dependent. Sweden rejects it with arms.', 'Your principles threaten the order and independence of my kingdom. We will resist.'],
    ambition: ['Sweden was not raised from weakness to stand idle. We now claim the position our strength deserves.', 'A state is secured by decisive action. Sweden marches to shape its own future.'],
  },
  leader_vytautas: {
    conquest: ['Your open frontier offers Lithuania room to grow and safety to gain. I will take both.', 'The balance favors my riders and your lands lie within reach. Lithuania advances.'],
    hostility: ['Your hostility has crossed every border before my army did. Now Lithuania answers.', 'You have made enmity your policy. I will make war its consequence.'],
    threat: ['Your power gathers along our horizon. Lithuania will ride before that storm can break.', 'I will not permit your armies to choose the time and place. We strike first.'],
    ideological: ['Your vision leaves no place for the realm I defend. Lithuania will contest it in battle.', 'The order you demand is one we cannot accept. Our banners will answer yours.'],
    ambition: ['Great realms are made by those who see beyond their present borders. Lithuania rides.', 'Opportunity has opened the eastern road. I intend to follow it with an army.'],
  },
  leader_marfa_boretskaya: {
    conquest: ['Your weakness endangers the roads and markets around us. Novgorod will secure them.', 'Trade needs stable hands and guarded routes. Your territory will now provide both.'],
    hostility: ['You have repaid negotiation with insult and commerce with obstruction. Novgorod has had enough.', 'Our council sought peace long after you abandoned good faith. We now choose war.'],
    threat: ['Your forces threaten the liberty of our city. We will meet them before they reach our gates.', 'Novgorod will not wait to be surrounded. We act now to preserve our freedom.'],
    ideological: ['Your rule would silence the liberties of our republic. Novgorod will resist it.', 'We will not exchange civic freedom for your imposed order. Let arms defend our choice.'],
    ambition: ['Novgorod must command the routes on which its future depends. We will secure them by force.', 'A wealthy republic that cannot act will soon serve another. We act today.'],
  },
  leader_mehmed_ii: {
    conquest: ['Your walls mark only the next boundary of my empire. They will fall.', 'I have studied your defenses and chosen the hour. Your realm will be added to mine.'],
    hostility: ['You have mistaken restraint for weakness and insulted my throne once too often. War begins.', 'Every provocation has brought you closer to this judgment. My armies will deliver it.'],
    threat: ['Your growing power obstructs the future of my empire. I will break it before it hardens.', 'I do not wait for rivals to become invincible. We strike while victory is ours to command.'],
    ideological: ['Your order denies the destiny of mine. The contest will now be decided by arms.', 'Two visions claim this frontier, and they cannot both prevail. My army will decide.'],
    ambition: ['The world remembers conquerors, not those who guarded yesterday. My empire advances.', 'A throne proves its greatness by extending its reach. Today I prove mine.'],
  },
  leader_isabella_i: {
    conquest: ['Your divided realm invites a stronger crown to restore order. We shall do so.', 'Unity and security require lands your rule cannot hold. My armies will claim them.'],
    hostility: ['You have rejected peace and dishonored every pledge. My crown now answers with war.', 'Your offenses can no longer be forgiven without weakening the realm. Judgment comes by arms.'],
    threat: ['Your power threatens the unity I have built. We will strike before you can divide us.', 'I will not leave my kingdoms at the mercy of your preparations. War is now necessary.'],
    ideological: ['Your beliefs stand against the sacred order of my realm. We will oppose them.', 'There can be no lasting peace while your doctrine challenges the foundation of our crown.'],
    ambition: ['A united crown must carry its purpose beyond old frontiers. We now advance.', 'Providence favors resolve. My kingdoms will seize the future before others shape it for us.'],
  },
  leader_abu_said_uthman_ii: {
    conquest: ['Your hold on these roads is weak. Morocco will secure the routes and the lands around them.', 'The western trade paths require a stronger guardian. My armies will provide one.'],
    hostility: ['You have poisoned commerce and friendship alike. Morocco will endure no more.', 'Our patience crossed deserts to reach you, yet you answered only with hostility. War follows.'],
    threat: ['Your preparations threaten our cities and caravans. We will move before you close the routes.', 'Morocco cannot wait while danger gathers beyond its frontier. We strike to preserve our realm.'],
    ideological: ['Your order leaves no honorable peace for ours. Morocco will defend its principles.', 'The values you impose cannot pass unchallenged into our lands. We take up arms.'],
    ambition: ['Morocco must command its own horizon. Our banners will travel with our caravans.', 'Wealth without strength invites conquest. Today Morocco chooses strength and expansion.'],
  },
  'leader_george-washington': {
    conquest: ['Your position threatens the security of our republic. We will seize the ground needed for a lasting peace.', 'The frontier cannot remain in hands that endanger our people. Our army will secure it.'],
    hostility: ['You have met every peaceful appeal with injury. We now take up arms with a clear conscience.', 'Our patience was not submission. Your repeated offenses have made war unavoidable.'],
    threat: ['Your military preparations place our liberty in immediate danger. We will act before it is too late.', 'A free people need not wait for the first blow. We march to prevent it.'],
    ideological: ['Your tyranny is incompatible with the liberty of our republic. We will resist it by force.', 'We cannot preserve freedom while your system seeks to extinguish it. Our nations are at war.'],
    ambition: ['The republic must secure its future with more than declarations. We will act decisively.', 'Our nation has earned a place among powers, and we will defend that claim in battle.'],
  },
  'leader_mahatma-gandhi': {
    conquest: ['I sought no territory by violence, yet your weakness now endangers millions. We act with sorrow, not triumph.', 'This war is contrary to all I value, but leaving your misrule unchecked would bring greater suffering.'],
    hostility: ['You have closed every peaceful path and answered restraint with cruelty. With profound regret, we resist by force.', 'I cannot call this choice good, only necessary after every appeal has failed. War begins.'],
    threat: ['Your armies place our people in immediate peril. We will act now to prevent a greater violence later.', 'Nonviolence cannot require a nation to await destruction. We move because your threat leaves no safe alternative.'],
    ideological: ['Your system denies the dignity and freedom of our people. We oppose it reluctantly but firmly.', 'Peace cannot endure where human dignity is treated as weakness. We are compelled to resist.'],
    ambition: ['I distrust ambition armed with soldiers, even our own. Yet the state has chosen this course, and I will demand restraint.', 'This is not a war I celebrate. May its purpose be limited and its end come quickly.'],
  },
  'leader_qin-shi-huang': {
    conquest: ['Your fragmented lands require order. They will be brought beneath one law and one authority.', 'The map contains a disorder that my armies will correct. Your realm will be unified with mine.'],
    hostility: ['Your defiance has outlived every warning. The state will now remove it.', 'You have made disorder a policy. I will answer with the full discipline of the empire.'],
    threat: ['Your forces disturb the security of the realm. They will be broken before they can advance.', 'An emperor does not wait for danger to cross his walls. We strike now.'],
    ideological: ['Your divided customs resist the order that secures civilization. One law will prevail.', 'There cannot be two foundations for lasting rule. Yours will yield to mine.'],
    ambition: ['All beneath heaven must know a single order. My armies continue that work.', 'History is shaped by unification, not hesitation. The empire expands.'],
  },
  leader_koxinga: {
    conquest: ['Your coast is exposed and your harbors command our future. We will take them.', 'The sea has shown me the opening in your defenses. My fleet will widen it.'],
    hostility: ['You have harried our ships and mocked every warning. The fleet now answers.', 'Your conduct has turned disputed waters into a battlefield. We come prepared.'],
    threat: ['Your fleet threatens our islands and trade. We will meet it before it reaches our shores.', 'I will not allow you to close the sea around us. We strike to keep it open.'],
    ideological: ['Your rule would extinguish the cause we carry across the sea. We will not submit.', 'The loyalties that divide us admit no compromise. Our fleets will decide the matter.'],
    ambition: ['Command of the sea belongs to those bold enough to claim it. We sail for victory.', 'An island power must expand or be contained. I choose expansion.'],
  },
  'leader_dom-pedro-ii': {
    conquest: ['Your weakness destabilizes our frontier. Brazil will establish the security you could not.', 'The future of this continent requires firmer borders. Brazil will draw them.'],
    hostility: ['I preferred reason, but you have made reason impossible. Brazil now goes to war.', 'Your repeated provocations have defeated every attempt at accommodation. The responsibility is yours.'],
    threat: ['Your military growth threatens the peace of our people. We must act before the balance is lost.', 'I will not gamble Brazil’s future on your restraint. Our forces move today.'],
    ideological: ['Your political order stands against the institutions we mean to preserve. Brazil will oppose it.', 'Our nations no longer dispute policy alone, but the principles of government. War follows.'],
    ambition: ['Brazil must take its rightful place among the great nations. Reluctantly, we will prove our strength.', 'Progress requires security and influence. Our armies will obtain what diplomacy could not.'],
  },
  'leader_mansa-musa': {
    conquest: ['Your lands command routes that prosperity cannot leave unsecured. Mali will take responsibility for them.', 'The roads of trade favor the strong. My army will place them under Mali’s protection.'],
    hostility: ['You have answered generosity with contempt and trade with obstruction. Mali now answers in force.', 'Gold bought patience, but it cannot purchase honor from you. We go to war.'],
    threat: ['Your armies threaten the cities and caravans of Mali. We will act before commerce becomes ruin.', 'I will not wait while danger gathers along the roads that sustain our people.'],
    ideological: ['Your principles would impoverish both spirit and society. Mali will defend its order.', 'Our learning and faith cannot prosper beneath the rule you propose. We resist.'],
    ambition: ['Mali’s wealth must be matched by influence and strength. Our reach now expands.', 'A great realm does not merely possess riches; it shapes the world around them. We march.'],
  },
  'leader_genghis-khan': {
    conquest: ['Your army is weak and your lands are open. My riders will take both before sunset forgets your name.', 'The steppe has no walls, and soon neither will your kingdom. The horde is coming.'],
    hostility: ['You have insulted the Khan and broken faith with the Mongols. Your cities will answer for it.', 'I offered you the peace of obedience. You chose the ruin of defiance.'],
    threat: ['Your warriors gather as if the Khan were blind. I will scatter them before they can strike.', 'A rival army grows only once beneath my sky. The horde rides now.'],
    ideological: ['Your customs make you proud and divided. The law of the steppe will humble both.', 'You cling to an order too weak to survive. The Mongols will replace it.'],
    ambition: ['The sky is vast, and one will is enough beneath it. Mine.', 'Every horizon calls to the horde. Your realm happens to stand beyond the next one.'],
  },
  'leader_oda-nobunaga': {
    conquest: ['Your defenses belong to an age already ending. I will sweep them aside and unify what remains.', 'I see the weakness in your formation and the prize beyond it. We attack.'],
    hostility: ['You have mistaken discipline for patience without limit. I will now correct you by force.', 'Your insolence has become an obstacle to unification. Obstacles are removed.'],
    threat: ['Your armies gather while lesser rulers hesitate. I do not. We strike first.', 'I will not permit an old rival to become a new master. Your strength ends here.'],
    ideological: ['You cling to traditions that preserve division and weakness. I will break them with your armies.', 'The future cannot coexist with the order you defend. Let battle choose the age that survives.'],
    ambition: ['The realm will be remade by fire, discipline, and will. Today that work reaches you.', 'Only decisive rulers shape history. I intend to leave it no doubt.'],
  },
  'leader_christian-iv': {
    conquest: ['Your ports and provinces would prosper under a stronger crown. Denmark will claim them.', 'The northern balance favors us. My fleet and army will turn advantage into territory.'],
    hostility: ['You have made an enemy of a king who offered fair terms. Denmark now answers your choice.', 'Every slight has been counted, and the account is due. We are at war.'],
    threat: ['Your growing power casts too long a shadow across northern waters. Denmark will shorten it.', 'I will not wait for your fleet to command our coasts. We sail and march now.'],
    ideological: ['The order you champion threatens crown and kingdom alike. Denmark will oppose it.', 'Your principles leave no secure peace for my realm. Our forces will settle the dispute.'],
    ambition: ['Denmark was built for more than watching others divide the north. We make our claim.', 'A builder-king must sometimes build with victories. This war will enlarge my legacy.'],
  },
  leader_mad_jack: {
    conquest: ['Your coast is fat, your guard is thin, and my crews are bored. A perfect war.', 'I have room in my hold and your ports have plenty to fill it. Here we come.'],
    hostility: ['You have crossed Mad Jack once too often. Now I cross your border.', 'No more letters, no more warnings. I am coming for your ships and everything behind them.'],
    threat: ['That fleet of yours is getting far too large for my comfort. Best I sink it early.', 'You look ready to hunt pirates. Bad luck—I have decided to hunt you first.'],
    ideological: ['You call it law; I call it chains with a fancy seal. My cannons vote against it.', 'Your tidy little order has no place for free captains. We will make some room.'],
    ambition: ['The sea deserves a legend, and I deserve a larger legend. Your shores will help.', 'Why rule one harbor when I can plunder ten? Hoist the colors—we are going to war.'],
  },
  'hermann-the-cheruscan': {
    conquest: ['Your frontier is weak, and taking it will keep stronger empires from our forests. The tribes advance.', 'The ground beyond our shields offers safety and strength. We will claim it.'],
    hostility: ['You have pressed us as Rome once did. You will receive the same answer.', 'Every warning was ignored and every boundary tested. Now the tribes rise against you.'],
    threat: ['Your armies approach the freedom of our people. We strike before they enter our forests.', 'We know what follows when an empire gathers at the frontier. This time, we meet it first.'],
    ideological: ['No empire dictates the life of free tribes. We will break the order you seek to impose.', 'Your rule demands submission; our freedom demands resistance. War decides between them.'],
    ambition: ['The tribes have stood apart long enough. United, we will carry our strength beyond the forest.', 'Freedom survives through strength, and strength must sometimes seize the initiative. We march.'],
  },
  'ivan-iv': {
    conquest: ['I have measured your strength and found it wanting. The frontier will move at your expense.', 'Your lands lie exposed before the Russian state. They will not remain yours for long.'],
    hostility: ['Every insult has been remembered and every betrayal recorded. Russia now delivers judgment.', 'You mistook my suspicion for uncertainty. I am certain now: you are an enemy to be crushed.'],
    threat: ['Your power grows too near my throne. I will destroy it before it can turn against Russia.', 'I trust neither your assurances nor your armies. We strike before your mask slips.'],
    ideological: ['Your order challenges the authority on which Russia stands. It will be broken.', 'There is no peace between your vision and my throne. One must submit, and it will not be Russia.'],
    ambition: ['Russia does not ask history for room. It takes room and dares others to object.', 'An empire that stops expanding begins to decay. I will permit neither.'],
  },
  leader_joseph_stalin: {
    conquest: ['Your weakness has become a strategic liability. The Soviet state will secure the territory itself.', 'The balance of forces is decisive. Our armies will advance and establish a new reality.'],
    hostility: ['Your actions have made coexistence impossible. The full strength of the Soviet state will answer.', 'We have recorded every provocation. The time for warnings is over; military operations begin.'],
    threat: ['Your military preparations constitute an intolerable threat. We will eliminate it before you strike.', 'We do not rely on an enemy’s promises while its armies mobilize. The Soviet Union acts now.'],
    ideological: ['Your system stands in irreconcilable opposition to ours. The conflict now enters its military phase.', 'The struggle between our orders can no longer be contained by diplomacy. We are at war.'],
    ambition: ['History does not wait for hesitant states. The Soviet Union will shape the balance by force.', 'Our strength has created an opportunity that the state will not waste. The advance begins.'],
  },
  leader_winston_churchill: {
    conquest: ['Your weakness has opened a danger that Britain must close. We shall take the ground and hold it.', 'The strategic position cannot remain in uncertain hands. Britain will secure it.'],
    hostility: ['You have exhausted argument, patience, and every honorable alternative. Britain will now fight.', 'Your repeated provocations have made peace a disguise for surrender. We reject it.'],
    threat: ['Your armaments and ambitions leave us no safe refuge in delay. We shall strike and we shall endure.', 'Britain will not wait meekly for the blow you prepare. We enter this struggle with our eyes open.'],
    ideological: ['Your tyranny cannot be accommodated without abandoning everything free nations defend. We are at war.', 'Between your doctrine and our liberty there can be no lasting compromise. Britain will resist.'],
    ambition: ['Britain does not seek glory cheaply, but neither will she surrender opportunity to the timid. We act.', 'The hour calls for boldness, and history will not forgive hesitation. Britain goes forward.'],
  },
  leader_adolf_hitler: {
    conquest: ['Your weakness has made the outcome inevitable. German forces will take what strategy requires.', 'The balance of power is settled. Your territory now stands in the path of German expansion.'],
    hostility: ['Relations between us have passed beyond repair. Germany will now answer your opposition with force.', 'Every confrontation has confirmed that coexistence no longer serves German interests. War begins.'],
    threat: ['Your military buildup threatens Germany’s position. We will strike before you can use it against us.', 'Waiting would hand you the strategic advantage. Germany will act first and remove the danger.'],
    ideological: ['Our political orders cannot occupy the same future. Germany will impose the issue by force.', 'The conflict between our systems can no longer be contained by diplomacy. We are at war.'],
    ambition: ['Germany has the strength to reshape the balance of power, and it will now use it.', 'History is decided by nations willing to act. Germany will seize this opportunity by force.'],
  },
  leader_benito_mussolini: {
    conquest: [
      'Your weakness is plain, and Italy will not let such an opportunity pass. Our standards advance, and victory will enlarge our greatness.',
      'The balance of strength favors Italy. We shall take the ground your feeble defense can no longer command.',
    ],
    hostility: [
      'You have answered Italian dignity with insult and obstruction. Before the world, Italy now answers your provocations with war.',
      'Your hostility has exhausted our patience and offended our national honor. The accusation is yours; the reply will be delivered by our armies.',
    ],
    threat: [
      'You gather strength as though Italy would tremble and wait. We defy your threat and strike before it can overshadow our nation.',
      'Your preparations menace Italy, but intimidation will earn you no submission. We meet danger with steel and unbroken resolve.',
    ],
    ideological: [
      'Your political order denies the authority, unity, and national purpose Italy represents. The contest between us will now be decided by force.',
      'Your principles stand against the disciplined greatness Italy demands. There can be no prestige in yielding to them, so we march.',
    ],
    ambition: [
      'A great nation does not wait meekly for history to grant it stature. Italy seizes this hour, and the world shall witness our ascent.',
      'Italy was not made for a minor place among nations. Our strength is ready, our ambition is declared, and our armies move.',
    ],
  },
  leader_wladyslaw_sikorski: {
    conquest: [
      'Your exposed position offers Poland a strategic advantage we cannot responsibly ignore. We will secure it with disciplined force.',
      'The balance now permits us to strengthen Poland’s frontier at your expense. This is a calculated campaign, and our army is ready.',
    ],
    hostility: [
      'You have broken trust, rejected restraint, and treated every commitment as expendable. Poland now answers your hostility with arms.',
      'Your repeated provocations have destroyed the basis for peace between us. Poland will meet this betrayal with firm military action.',
    ],
    threat: [
      'Your military preparations place Poland’s sovereignty in immediate danger. We will not wait helplessly for the first blow.',
      'You have chosen intimidation and brought your forces against our security. Poland stands ready, and we strike to ensure that Poland endures.',
    ],
    ideological: [
      'Your political order threatens the sovereignty and commitments on which our security depends. Poland will resist it with disciplined force.',
      'The principles you advance leave independent nations no dependable peace. We oppose them now, resolutely and without illusion.',
    ],
    ambition: [
      'Poland cannot preserve its future by remaining absent from every contest of power. We act now because the opportunity is strategically sound.',
      'This war is not undertaken for spectacle, but for lasting security and influence. Poland’s forces will pursue that objective with discipline.',
    ],
  },
};

export const FALLBACK_WAR_DECLARATIONS: WarDeclarationPhrases = {
  conquest: ['Your weakness offers an opportunity we will not ignore.', 'Our forces will take the ground that victory places within reach.'],
  hostility: ['Our grievances can no longer be settled peacefully. We are at war.', 'You have exhausted every peaceful alternative. We now answer with force.'],
  threat: ['Your preparations leave us no safe choice but to strike first.', 'We will act now rather than wait for your threat to grow.'],
  ideological: ['Our principles can no longer coexist in peace. War will decide between them.', 'The order you defend is incompatible with ours. We take up arms.'],
  ambition: ['The moment favors decisive action, and we intend to seize it.', 'History offers an opportunity that our armies will now pursue.'],
};

export function getLeaderWarDeclarationPhrases(leaderId: string): WarDeclarationPhrases {
  return getLeaderConfiguration().warDeclarations?.[leaderId] ?? LEADER_WAR_DECLARATIONS[leaderId] ?? FALLBACK_WAR_DECLARATIONS;
}

/** Stable selection: identical game facts reproduce the same line after load/autorun. */
export function getLeaderWarDeclarationPhrase(
  leaderId: string,
  reason: WarDeclarationReason,
  deterministicSeed: string | number,
): string {
  const phrases = getLeaderWarDeclarationPhrases(leaderId)[reason];
  return phrases[stableHash(`${leaderId}|${reason}|${deterministicSeed}`) % phrases.length];
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
