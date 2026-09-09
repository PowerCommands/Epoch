export interface NationDefinition {
  id: string;
  name: string;
  color: string;
  secondaryColor: string;
  currencyName: string;
  currencySymbol: string;
  /** Optional data-driven reuse of another nation's audio/music playlist assets. */
  audioPlaylistNationId?: string;
  /** Playlist key (including shared audio folders) in the sounds manifest. */
  audioPlaylistId?: string;
}

export const NATION_DEFINITIONS: readonly NationDefinition[] = [
  { id: 'nation_england', name: 'England', color: '#dd203f', secondaryColor: '#3714c3', currencyName: 'Pound Sterling', currencySymbol: '£' },
  { id: 'nation_france', name: 'France', color: '#1e0af1', secondaryColor: '#f4efe2', currencyName: 'Franc', currencySymbol: '₣' },
  { id: 'nation_hre', name: 'Holy Roman Empire', color: '#e8c84a', secondaryColor: '#4a4030', currencyName: 'Imperial Thaler', currencySymbol: 'Th' },
  { id: 'nation_sweden', name: 'Sweden', color: '#2541d0', secondaryColor: '#e6ad3d', currencyName: 'Krona', currencySymbol: 'kr' },
  { id: 'nation_lithuania', name: 'Lithuania', color: '#f4870b', secondaryColor: '#201f1e', currencyName: 'Litas', currencySymbol: 'Lt' },
  { id: 'nation_novgorod', name: 'Novgorod', color: '#16a085', secondaryColor: '#e7d7a8', currencyName: 'Novgorod Grivna', currencySymbol: 'gr' },
  { id: 'nation_russia', name: 'Russia', color: '#ffffff', secondaryColor: '#0039a6', currencyName: 'Ruble', currencySymbol: '₽' },
  { id: 'nation_soviet_union', name: 'Soviet Union', color: '#8b1a1a', secondaryColor: '#d4af37', currencyName: 'Soviet Ruble', currencySymbol: '₽', audioPlaylistNationId: 'nation_russia' },
  { id: 'nation_ottoman', name: 'Ottoman Empire', color: '#c44ae8', secondaryColor: '#7fd1c7', currencyName: 'Akçe', currencySymbol: 'ak' },
  { id: 'nation_spain', name: 'Spain', color: '#e84a4a', secondaryColor: '#f2d15c', currencyName: 'Spanish Real', currencySymbol: 'R' },
  { id: 'nation_morocco_empire', name: 'Morocco', color: '#9b5f4b', secondaryColor: '#d9c39a', currencyName: 'Moroccan Dirham', currencySymbol: 'د.م.' },
  { id: 'nation_usa', name: 'United States', color: '#2f80ed', secondaryColor: '#fe0000', currencyName: 'Dollar', currencySymbol: '$' },
  { id: 'nation_india', name: 'India', color: '#27ae60', secondaryColor: '#f3d27a', currencyName: 'Rupee', currencySymbol: '₹' },
  { id: 'nation_china', name: 'China', color: '#f0c46b', secondaryColor: '#d64541', currencyName: 'Renminbi', currencySymbol: '¥' },
  { id: 'nation_taiwan', name: 'Taiwan', color: '#012169', secondaryColor: '#fe0000', currencyName: 'New Taiwan Dollar', currencySymbol: 'NT$' },
  { id: 'nation_brazil', name: 'Brazil', color: '#009739', secondaryColor: '#ffdf00', currencyName: 'Brazilian Real', currencySymbol: 'R$' },
  { id: 'nation_mali_empire', name: 'Mali Empire', color: '#b7950b', secondaryColor: '#5b4b2a', currencyName: 'Malian Gold Dinar', currencySymbol: 'MD' },
  { id: 'nation_mongolia', name: 'Mongolia', color: '#c49a2c', secondaryColor: '#3a2a14', currencyName: 'Tögrög', currencySymbol: '₮' },
  { id: 'nation_japan', name: 'Japan', color: '#ffffff', secondaryColor: '#bc002d', currencyName: 'Yen', currencySymbol: '¥' },
  { id: 'nation_denmark', name: 'Denmark', color: '#80071b', secondaryColor: '#ffffff', currencyName: 'Krone', currencySymbol: 'kr' },
  { id: 'nation_pirate', name: 'Pirates', color: '#1a1a1a', secondaryColor: '#c0392b', currencyName: 'Pieces of Eight', currencySymbol: '☠' },
  { id: 'nation_germany', name: 'Germany', color: '#2b2b2b', secondaryColor: '#d4af37', currencyName: 'Mark', currencySymbol: 'ℳ' },
  { id: 'nation_italy', name: 'Italy', color: '#0b6b3a', secondaryColor: '#ce2b37', currencyName: 'Lira', currencySymbol: '₤' },
  { id: 'nation_poland', name: 'Poland', color: '#d4213d', secondaryColor: '#f5f5f5', currencyName: 'Polish Złoty', currencySymbol: 'zł' },
  {"id": "nation_finland", "name": "Finland", "color": "#003580", "secondaryColor": "#ffffff", "currencyName": "Euro", "currencySymbol": "€"},
  {"id": "nation_canada", "name": "Canada", "color": "#d52b1e", "secondaryColor": "#ffffff", "currencyName": "Canadian Dollar", "currencySymbol": "$"},
  {"id": "nation_mexico", "name": "Mexico", "color": "#006847", "secondaryColor": "#ce1126", "currencyName": "Mexican Peso", "currencySymbol": "$"},
  {"id": "nation_argentina", "name": "Argentina", "color": "#74acdf", "secondaryColor": "#ffffff", "currencyName": "Argentine Peso", "currencySymbol": "$"},
  {"id": "nation_ukraine", "name": "Ukraine", "color": "#0057b7", "secondaryColor": "#ffd700", "currencyName": "Hryvnia", "currencySymbol": "₴"},
  {"id": "nation_iran", "name": "Iran", "color": "#16846b", "secondaryColor": "#c93442", "currencyName": "Iranian Rial", "currencySymbol": "﷼", "audioPlaylistId": "nations_middle_east"},
  {"id": "nation_iraq", "name": "Iraq", "color": "#4b5346", "secondaryColor": "#ce3038", "currencyName": "Iraqi Dinar", "currencySymbol": "د.ع", "audioPlaylistId": "nations_middle_east"},
  {"id": "nation_egypt", "name": "Egypt", "color": "#c19a45", "secondaryColor": "#982e35", "currencyName": "Egyptian Pound", "currencySymbol": "E£", "audioPlaylistId": "nations_middle_east"},
  {"id": "nation_israel", "name": "Israel", "color": "#478fce", "secondaryColor": "#f7f4e9", "currencyName": "Israeli New Shekel", "currencySymbol": "₪", "audioPlaylistId": "nations_middle_east"},
  {"id": "nation_turkey", "name": "Turkey", "color": "#b93648", "secondaryColor": "#ffffff", "currencyName": "Turkish Lira", "currencySymbol": "₺", "audioPlaylistId": "nations_middle_east"},
  {"id": "nation_saudi_arabia", "name": "Saudi Arabia", "color": "#14613f", "secondaryColor": "#e3d8ac", "currencyName": "Saudi Riyal", "currencySymbol": "ر.س", "audioPlaylistId": "nations_middle_east"},
];

export function getNationDefinitionById(nationId: string): NationDefinition | undefined {
  return NATION_DEFINITIONS.find((nation) => nation.id === nationId);
}
