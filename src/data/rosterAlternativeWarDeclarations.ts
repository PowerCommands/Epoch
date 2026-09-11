import type { WarDeclarationPhrases } from '../types/warDeclaration';

/** Fictional lines selected only after the ordinary AI decides to declare war. */
export const ROSTER_ALTERNATIVE_WAR_DECLARATIONS: Readonly<Record<string, WarDeclarationPhrases>> = {
  "leader_frederick_barbarossa": {
    "conquest": [
      "The imperial host will bring these disputed lands under our authority.",
      "Our banners will advance where imperial claims have been denied."
    ],
    "hostility": [
      "You have answered lawful demands with repeated hostility. The empire will respond.",
      "Your defiance has exhausted the patience of this court. We are at war."
    ],
    "threat": [
      "An armed danger gathers at our frontier. We shall meet it in the field.",
      "The empire will strike before your preparations become an invasion."
    ],
    "ideological": [
      "You reject the imperial order and seek to unmake it. Our armies will defend it.",
      "We will fight the political disorder you would impose upon our lands."
    ],
    "ambition": [
      "The opportunity to strengthen imperial authority is before us. We will take it.",
      "A divided empire cannot endure. This campaign will establish our position."
    ]
  },
  "leader_mindaugas": {
    "conquest": [
      "Our warriors will secure the land needed to hold this kingdom together.",
      "We will take the contested approaches and settle this frontier by force."
    ],
    "hostility": [
      "Your interference has broken our compact. Lithuania will answer with arms.",
      "You have turned negotiation into a weapon against our unity. We will resist."
    ],
    "threat": [
      "We will not let your preparations divide our newly gathered lands.",
      "The kingdom must act before the danger at its border grows beyond control."
    ],
    "ideological": [
      "You seek to overturn the settlement that holds our crown and lands together.",
      "We will defend our right to shape the institutions of this kingdom."
    ],
    "ambition": [
      "Lithuania must secure its place while the balance allows it. We will advance.",
      "This campaign will determine whether our state can stand on its own."
    ]
  },
  "leader_alexander_nevsky": {
    "conquest": [
      "We will take the approaches from which Novgorod can be threatened.",
      "Our army will secure a frontier that can be held against stronger powers."
    ],
    "hostility": [
      "Your attacks have left no room for the restraint we offered.",
      "Novgorod has endured your provocations. Our forces will now answer them."
    ],
    "threat": [
      "You prepare to enter our lands. We will meet you before you reach our towns.",
      "The danger is plain. Our warriors will not wait for the first city to burn."
    ],
    "ideological": [
      "We will fight the order you seek to force upon our people.",
      "Our lands will not surrender their institutions at a foreign command."
    ],
    "ambition": [
      "We must change this balance before it closes around us. Our army will act.",
      "Novgorod will seize the chance to secure its survival by force."
    ]
  },
  "leader_mikhail_gorbachev": {
    "conquest": [
      "We have ordered an advance to secure the disputed positions and force a settlement.",
      "Our forces will occupy the contested ground. We must then return to talks."
    ],
    "hostility": [
      "Your repeated hostile actions have defeated the negotiations. We will respond militarily.",
      "We sought de-escalation. Your government has left this dispute to force."
    ],
    "threat": [
      "We will act against the immediate military danger while keeping negotiations open.",
      "Our security cannot wait upon promises contradicted by your preparations."
    ],
    "ideological": [
      "We will resist by force your attempts to dictate the course of our reforms.",
      "Political renewal cannot proceed under an imposed foreign ultimatum. We will fight."
    ],
    "ambition": [
      "Our government has chosen force to alter this strategic position.",
      "We have authorized a campaign to secure a new settlement. Its cost must remain limited."
    ]
  },
  "leader_suleiman_the_magnificent": {
    "conquest": [
      "The imperial army will secure these provinces and place them under ordered government.",
      "Our banners will advance along the routes essential to imperial administration."
    ],
    "hostility": [
      "You have repeatedly harmed the peace of our frontier. The army will answer.",
      "The Porte offered terms. Your continued hostility has brought war."
    ],
    "threat": [
      "We will remove the military danger to our provinces and commercial roads.",
      "Your preparations threaten the stability of the empire. We must act."
    ],
    "ideological": [
      "Our law and sovereignty will not yield to the order you would impose.",
      "You seek to replace imperial authority with foreign direction. We will resist."
    ],
    "ambition": [
      "This campaign will establish a position that our treasury and governors can sustain.",
      "The empire will take this opportunity to strengthen its lasting influence."
    ]
  },
  "leader_mohammed_v": {
    "conquest": [
      "Morocco will secure the contested ground needed for a defensible settlement.",
      "Our forces will take the positions from which our independence is threatened."
    ],
    "hostility": [
      "Your repeated hostility has exhausted the path of negotiation.",
      "We sought a partnership of sovereign states. Your actions have brought armed conflict."
    ],
    "threat": [
      "Our nation will act before your preparations become an assault.",
      "Morocco cannot leave its independence exposed to this military danger."
    ],
    "ideological": [
      "You will not prescribe the government of an independent Morocco. We will resist.",
      "Our national institutions will not be remade under foreign military pressure."
    ],
    "ambition": [
      "We will act to establish a stronger position for our independent state.",
      "The crown has authorized this campaign to secure Morocco's future standing."
    ]
  },
  "leader_tsai_ing_wen": {
    "conquest": [
      "Our forces will take the contested positions needed to secure this settlement.",
      "We have authorized an advance to control the approaches now at issue."
    ],
    "hostility": [
      "Your repeated hostile acts have made a military response necessary.",
      "Taiwan sought a workable agreement. Your actions have closed that path."
    ],
    "threat": [
      "We will act against your preparations before they become an attack.",
      "The threat to our security is immediate. Our forces have orders to respond."
    ],
    "ideological": [
      "Our society's political choices cannot be dictated by your government. We will resist.",
      "We will defend our institutions against the order you seek to impose by force."
    ],
    "ambition": [
      "We have chosen to change this strategic position through a limited campaign.",
      "Our government has authorized force to secure a more durable balance."
    ]
  },
  "leader_sundiata_keita": {
    "conquest": [
      "Mali will bring these lands into the realm we are building.",
      "Our warriors will advance and secure the routes that bind the kingdom together."
    ],
    "hostility": [
      "You have attacked the unity of our realm. Our armies will answer.",
      "Your repeated hostility ends the possibility of a peaceful compact."
    ],
    "threat": [
      "We will meet your gathering army before it can divide our people.",
      "The kingdom must act against the danger you have brought to its frontier."
    ],
    "ideological": [
      "We will not surrender the order our peoples have forged together.",
      "You would break our union to impose your own rule. We will fight."
    ],
    "ambition": [
      "Mali has the strength to enlarge its place among the kingdoms. We will march.",
      "The time has come to turn our gathered strength into a lasting realm."
    ]
  },
  "leader_kublai_khan": {
    "conquest": [
      "Our army will secure the cities and routes needed to govern this frontier.",
      "The imperial administration will follow our forces into the contested lands."
    ],
    "hostility": [
      "You have repeatedly obstructed our roads and challenged our authority. We will respond.",
      "Negotiations have failed to restrain your hostility. The empire will use force."
    ],
    "threat": [
      "Our cities and trade routes will not remain exposed to your gathering army.",
      "The empire will act before your military preparations threaten its heartlands."
    ],
    "ideological": [
      "We will fight your attempt to dictate the government of our realm.",
      "The imperial order will not be replaced by a foreign command."
    ],
    "ambition": [
      "This campaign will strengthen a position our cities and treasury can sustain.",
      "We will use this opportunity to secure a richer and more durable empire."
    ]
  },
  "leader_tokugawa_ieyasu": {
    "conquest": [
      "We will take the disputed ground and establish a frontier that can be administered.",
      "Our commanders will secure the approaches required for an orderly settlement."
    ],
    "hostility": [
      "Your repeated interference threatens the peace of the realm. We will answer with force.",
      "The patience shown in negotiation has been exhausted by your actions."
    ],
    "threat": [
      "We will remove this danger before it can disturb the settlement at home.",
      "Your preparations require a military response. Our commanders are ready."
    ],
    "ideological": [
      "The institutions of our realm will not be remade at your direction.",
      "We will fight to preserve our political settlement against your imposed order."
    ],
    "ambition": [
      "The moment permits us to secure a lasting advantage. We will act deliberately.",
      "This campaign will establish the balance needed for long-term stability."
    ]
  },
  "leader_anne_bonny": {
    "conquest": [
      "Your harbor is worth taking, and my crews know its approaches.",
      "We will seize the anchorage that gives us command of this passage."
    ],
    "hostility": [
      "You have made war on our trade often enough. Now we will make it on yours.",
      "Your attacks have run up an account that my guns will collect."
    ],
    "threat": [
      "That fleet threatens our routes. Better to catch it before it catches us.",
      "We will strike while your ships are still preparing to sail against us."
    ],
    "ideological": [
      "You would hang our freedom from your harbor walls. We will fight your rule.",
      "Your laws leave no place for our crews. Our cannons have a different argument."
    ],
    "ambition": [
      "The cargo is rich, the escort is thin, and the tide is ours.",
      "There is profit in changing who controls these waters. We are sailing."
    ]
  },
  "leader_urho_kekkonen": {
    "conquest": [
      "Our forces will secure the contested approaches to make a stable settlement possible.",
      "Finland will take the positions required to restore a defensible balance."
    ],
    "hostility": [
      "Your actions have exhausted our efforts to maintain a workable relationship.",
      "We have sought accommodation. Your repeated hostility has brought a military response."
    ],
    "threat": [
      "We cannot preserve our independence while leaving this military threat unanswered.",
      "Finland will act before your preparations remove the possibility of defending our territory."
    ],
    "ideological": [
      "Our right to choose our own course will be defended by force if necessary.",
      "We will not accept a political order imposed by either side of a foreign contest."
    ],
    "ambition": [
      "Our government has chosen force to regain room for independent action.",
      "We will act to alter a balance that has become intolerable for Finland."
    ]
  },
  "leader_stephen_harper": {
    "conquest": [
      "Canadian forces will secure the disputed positions needed for our stated objectives.",
      "We have authorized an advance to take control of the contested ground."
    ],
    "hostility": [
      "Your repeated hostile actions demand a concrete response. Canada will act.",
      "Our warnings and negotiations have failed. We are committing military force."
    ],
    "threat": [
      "Canada will address this military danger before it becomes an attack.",
      "Our security commitments require action against the threat your forces present."
    ],
    "ideological": [
      "We will defend Canada's institutions against the political order you seek to impose.",
      "Your attempt to dictate our government's choices will meet armed resistance."
    ],
    "ambition": [
      "We have judged that this campaign can secure a necessary strategic advantage.",
      "Canada has authorized force to change the position our government faces."
    ]
  },
  "leader_vicente_fox": {
    "conquest": [
      "Our forces will take the disputed ground needed to bring this conflict to a settlement.",
      "Mexico has authorized an advance to control the contested approaches."
    ],
    "hostility": [
      "Your continued hostility has closed the commercial and diplomatic solutions we offered.",
      "We will use force in response to the repeated attacks your government has permitted."
    ],
    "threat": [
      "Mexico will act before your military preparations become an assault.",
      "We cannot keep our economy open while leaving our people exposed to this danger."
    ],
    "ideological": [
      "Our citizens' political choices will not be overturned by a foreign ultimatum.",
      "We will resist your attempt to impose a different government on Mexico."
    ],
    "ambition": [
      "We have chosen a military campaign to change this strategic position.",
      "Mexico will act to secure an advantage that negotiations have failed to obtain."
    ]
  },
  "leader_juan_peron": {
    "conquest": [
      "Argentina will secure the territory needed to protect its productive independence.",
      "Our forces will take the positions on which this national settlement depends."
    ],
    "hostility": [
      "Your repeated attacks on our interests have brought a military response.",
      "The Argentine government will answer the hostility that has frustrated every agreement."
    ],
    "threat": [
      "We will not leave our factories and cities exposed to your military preparations.",
      "The nation must act against the danger gathering beyond its borders."
    ],
    "ideological": [
      "You will not dictate the relationship between our state and its working people.",
      "Our national project will be defended against the political order you would impose."
    ],
    "ambition": [
      "We will use this moment to establish Argentina's independent strategic position.",
      "The armed forces will secure the advantage our national development requires."
    ]
  },
  "leader_petro_poroshenko": {
    "conquest": [
      "Our forces will take the contested positions needed to consolidate this frontier.",
      "Ukraine has authorized an advance to establish control over the ground at issue."
    ],
    "hostility": [
      "Your repeated hostile actions have made an armed response unavoidable.",
      "Ukraine will answer the attacks that your government has refused to halt."
    ],
    "threat": [
      "We will not let your military preparations outrun our ability to defend the state.",
      "Our forces will act against the danger you have brought to Ukraine's security."
    ],
    "ideological": [
      "Ukraine's institutions will not be dictated by your government's demands.",
      "We will fight your attempt to replace our sovereign political choices with foreign direction."
    ],
    "ambition": [
      "Ukraine will act to secure a stronger position while our forces are prepared.",
      "We have chosen this campaign to consolidate the state's strategic security."
    ]
  },
  "leader_mohammad_reza_pahlavi": {
    "conquest": [
      "Iranian forces will secure the disputed positions required for our regional strategy.",
      "We will take control of the approaches that this settlement requires."
    ],
    "hostility": [
      "Your repeated hostility threatens our development and security. Iran will respond.",
      "Our negotiations have been met with further interference. We have authorized force."
    ],
    "threat": [
      "Iran will act against the military danger to its cities and infrastructure.",
      "We have modernized our defenses to meet threats such as this. They will now respond."
    ],
    "ideological": [
      "We will defend our state's institutions against the political order you would impose.",
      "Iran's path of development will not be overturned by your government's ultimatum."
    ],
    "ambition": [
      "Our forces will use this opportunity to strengthen Iran's strategic standing.",
      "We have chosen a campaign that can secure our position as a modern regional power."
    ]
  },
  "leader_faisal_i": {
    "conquest": [
      "Our forces will take the contested ground needed to establish a governable frontier.",
      "Iraq will secure the approaches required for a lasting territorial settlement."
    ],
    "hostility": [
      "Your repeated interference threatens the foundations of our state. We must respond.",
      "The compact we sought has been defeated by your continued hostility."
    ],
    "threat": [
      "Iraq must act before your military preparations endanger the survival of our institutions.",
      "We will not allow this threat to grow while our state is still being built."
    ],
    "ideological": [
      "Our kingdom will resist your attempt to dictate its political settlement.",
      "We will fight to preserve Iraq's institutions against your imposed alternative."
    ],
    "ambition": [
      "This campaign will secure the regional position our new state requires.",
      "The kingdom has authorized force to improve the balance in which it must govern."
    ]
  },
  "leader_yitzhak_rabin": {
    "conquest": [
      "Our forces will secure the contested positions needed for the settlement we seek.",
      "We have authorized an advance to control the ground now essential to our objectives."
    ],
    "hostility": [
      "Your repeated hostile acts have left the negotiations without a basis. We will respond.",
      "Israel has authorized force after your government failed to halt these attacks."
    ],
    "threat": [
      "We will act against the immediate danger rather than wait for it to reach our cities.",
      "Military readiness must now answer the threat your forces present."
    ],
    "ideological": [
      "Our political institutions will not be remade under a foreign ultimatum.",
      "We will resist by force your attempt to dictate our government's choices."
    ],
    "ambition": [
      "We have chosen a military operation to establish a position from which a settlement is possible.",
      "Our government has authorized force to change this strategic balance."
    ]
  },
  "leader_mustafa_kemal_ataturk": {
    "conquest": [
      "The republic's army will secure the contested ground and establish a defensible frontier.",
      "Our forces will advance to the positions required by this settlement."
    ],
    "hostility": [
      "You have answered our sovereign decisions with repeated hostility. We will respond.",
      "The republic has exhausted negotiation. Its army will now act."
    ],
    "threat": [
      "We will not permit your preparations to place our republic at military mercy.",
      "Our professional forces will meet the danger before it reaches the heart of the state."
    ],
    "ideological": [
      "The republic's institutions and reforms will not be dictated from abroad.",
      "We will fight the political order you seek to impose upon our national life."
    ],
    "ambition": [
      "We will use this opportunity to secure the republic's independent position.",
      "This campaign will establish the strategic room our state needs to develop."
    ]
  },
  "leader_faisal_bin_abdulaziz": {
    "conquest": [
      "The kingdom will secure the disputed approaches needed for a stable regional settlement.",
      "Our forces will take the positions on which the proposed frontier must rest."
    ],
    "hostility": [
      "Your repeated hostile measures have defeated patient diplomacy. We will respond.",
      "The kingdom has offered restraint. Your actions have brought armed conflict."
    ],
    "threat": [
      "We will act against the danger your preparations present to the kingdom.",
      "Our defenses cannot leave this threat unanswered while its strength grows."
    ],
    "ideological": [
      "We will defend the kingdom's traditions and institutions against your imposed order.",
      "Our government will not accept a political settlement delivered by foreign coercion."
    ],
    "ambition": [
      "The kingdom has chosen to secure a stronger position through military action.",
      "We will use this moment to restore the regional balance our state requires."
    ]
  },
  "leader_thaksin_shinawatra": {
    "conquest": [
      "Our forces will secure the contested positions needed to settle this dispute.",
      "Thailand will take control of the approaches now essential to our objectives."
    ],
    "hostility": [
      "Your repeated hostility has obstructed every practical agreement. We will respond.",
      "Our government will use force against the attacks you have refused to stop."
    ],
    "threat": [
      "We will not leave our communities and development plans exposed to this danger.",
      "Thailand will act before your military preparations become an attack."
    ],
    "ideological": [
      "Our government's mandate cannot be replaced by your foreign ultimatum.",
      "We will defend our political choices against the order you seek to impose."
    ],
    "ambition": [
      "We have chosen a campaign to establish a stronger position for Thailand.",
      "Our forces will act to secure the advantage that this moment offers."
    ]
  },
  "leader_park_chung_hee": {
    "conquest": [
      "Our forces will secure the ground required to protect the industrial approaches.",
      "We will take control of the disputed positions and establish a defensible settlement."
    ],
    "hostility": [
      "Your repeated hostile actions threaten national development. The army will respond.",
      "Our warnings have not stopped your interference. We have authorized military force."
    ],
    "threat": [
      "Industrial strength cannot survive without security. We will act against this danger.",
      "Our prepared forces will answer your military threat before it reaches our cities."
    ],
    "ideological": [
      "We will fight your attempt to dictate the institutions of our state.",
      "Our national development program will not be dismantled under foreign pressure."
    ],
    "ambition": [
      "We will turn our preparation into a stronger strategic position.",
      "This campaign will secure an advantage that our industry and armed forces can sustain."
    ]
  },
  "leader_han_seo_jin": {
    "conquest": [
      "Our forces will secure the contested approaches needed to reach a stable settlement.",
      "We have authorized an advance to control the positions now at issue."
    ],
    "hostility": [
      "Your continued attacks have exhausted our efforts at normalization. We will defend ourselves.",
      "Negotiations cannot proceed under repeated assault. Our forces will respond."
    ],
    "threat": [
      "We will act against the immediate danger to our communities and reconstruction.",
      "Our opening to the world does not leave our people without defenses."
    ],
    "ideological": [
      "We will defend our citizens' right to build democratic institutions.",
      "Your attempt to impose a government by force threatens our transition. We will resist."
    ],
    "ambition": [
      "Our government has chosen a limited campaign to change this strategic position.",
      "We have authorized force to secure room for the reconstruction of our country."
    ]
  },
  "leader_sviatlana_tsikhanouskaya": {
    "conquest": [
      "Our forces will secure the disputed positions required for a lasting settlement.",
      "Belarus has authorized an advance to establish control over the contested approaches."
    ],
    "hostility": [
      "Your repeated hostile acts have defeated our efforts to reach an agreement.",
      "We will respond militarily to the attacks your government has refused to stop."
    ],
    "threat": [
      "Belarus will act against the immediate military danger to its people.",
      "Our democratic transition does not require us to leave this threat unanswered."
    ],
    "ideological": [
      "A foreign ultimatum cannot choose a government for Belarus. We will resist.",
      "We will defend our right to accountable government against the order you would impose."
    ],
    "ambition": [
      "We have authorized force to secure a more durable position for Belarus.",
      "Our government has chosen this campaign to obtain the strategic room our renewal requires."
    ]
  },
  "leader_peter_ii_of_yugoslavia": {
    "conquest": [
      "The kingdom's forces will secure the disputed ground needed for a stable frontier.",
      "Our commanders will take the positions required by the settlement we seek."
    ],
    "hostility": [
      "Your repeated hostility has undermined every attempt at agreement. The kingdom will respond.",
      "The crown has authorized force against the attacks you have refused to end."
    ],
    "threat": [
      "We will not leave the kingdom exposed to your military preparations.",
      "Our forces and partnerships exist to meet threats such as this. We will act."
    ],
    "ideological": [
      "The kingdom will resist your attempt to impose a different political order.",
      "We will fight to preserve our monarchical settlement against foreign dictation."
    ],
    "ambition": [
      "The crown has chosen this campaign to secure a stronger position among our partners.",
      "We will use this opportunity to establish the kingdom's lasting strategic standing."
    ]
  },
  "leader_vaclav_havel": {
    "conquest": [
      "The republic will occupy the contested positions needed to make a settlement possible.",
      "Our commanders will secure the disputed approaches. The government remains answerable for the consequences."
    ],
    "hostility": [
      "Your continued attacks have exhausted the possibility of an immediate agreement.",
      "The republic will respond militarily to the hostility your government has refused to end."
    ],
    "threat": [
      "We cannot protect an open society by ignoring an immediate military danger.",
      "Our forces will act against the threat your preparations present to our citizens."
    ],
    "ideological": [
      "We will defend the right of our people to democratic government.",
      "The political freedom of our republic will not be surrendered to your ultimatum."
    ],
    "ambition": [
      "We have accepted responsibility for a campaign to change the balance facing our republic.",
      "We have authorized force to secure a position from which a lasting agreement is possible."
    ]
  }
};
