import type { LeaderStatementDefinition, StatementContext } from '../types/leaderStatement';

/** Original, country-independent public rhetoric. No diplomatic memory effects. */
const pools: Partial<Record<StatementContext, readonly string[]>> = {
  general: [
    'The future has knocked, and I have instructed the government to open the door with considerable enthusiasm.',
    'Our programme is ambitious. History rarely reserves its finest pages for the timid footnote.',
    'I bring a simple message: this nation has talent, purpose, and a government determined to give both a larger stage.',
    'Progress requires patient work. Fortunately, I have enough enthusiasm to make patience sound exciting.',
    'We have no shortage of challenges. I prefer to regard that as a remarkably well-stocked workshop.',
    'There will be difficulties along the road. I intend to meet them standing up, preferably where everyone can see.',
    'My ministers have brought their plans. I have brought the conviction that we can make something magnificent of them.',
    'Our ambitions deserve a public hearing, and I am delighted to provide the voice.',
  ],
  economic_success: [
    'Trade is moving, opportunity is expanding, and our policy has helped put wind in the sails. A thoroughly encouraging spectacle.',
    'A new commercial connection may look like a line on a map. I see a splendid avenue of opportunity, and we helped open it.',
    'Our merchants are doing the work; this government has helped clear the road. Prosperity is a team effort with excellent direction.',
    'The economy has acquired another useful engine. I shall resist the temptation to conduct the orchestra from the engine room.',
  ],
  economic_difficulty: [
    'These are difficult figures. We shall face them squarely and get to work; pessimism has never repaired a single balance sheet.',
    'The economy has hit a pothole of impressive dimensions. Our task is to repair the road, not admire the hole.',
    'Families are feeling this setback. Our response must have more substance than a speech, even a particularly energetic one.',
    'This crisis calls for steady hands and a lively sense of what is still possible. We intend to supply both.',
  ],
  diplomatic_success: [
    'We have opened another door in diplomacy. I intend to keep it open long enough for something useful to walk through.',
    'Patient discussion has produced an excellent result. I supplied some of the patience and a considerable amount of the discussion.',
    'Our diplomats have turned a difficult conversation into a promising relationship. That deserves more than a quiet nod.',
  ],
  alliance: [
    'This alliance gives cooperation a backbone. Together we can accomplish rather more than a pair of ceremonial handshakes.',
    'We have found common purpose and put it into an agreement. A fine day for diplomacy, and a useful one for our people.',
    'Our new partnership is a serious commitment. The enthusiasm is mine; the obligations belong to us all.',
  ],
  peace_agreement: [
    'Peace has finally secured a place at the table. Now we must give it enough practical support to stay for the entire meal.',
    'The agreement is signed. I take pride in our contribution, and even greater satisfaction in the lives that can now be rebuilt.',
    'We can put our energy into the future again. That is an achievement worth announcing with the windows open.',
  ],
  construction: [
    'Here is our programme made tangible. Plans are useful, but I confess a particular fondness for achievements one can actually visit.',
    'This new city gives our ambitions an address. Let us make it a place where opportunity feels at home.',
    'Our builders have given the future a foothold. I am delighted that the future appears to share our sense of direction.',
  ],
  wonder: [
    'Our builders have produced something that will outlast the speeches. Even mine, which is saying something about the craftsmanship.',
    'This wonder is a declaration in stone that our nation has imagination as well as resolve. I am proud we made room for both.',
    'Future generations will look upon this achievement. We have given them a rather splendid reason to remember our time.',
    'There are days when ambition acquires a skyline. This is one of them, and our people deserve every moment of pride.',
  ],
  games_success: [
    'Our athletes have given the nation a magnificent moment. I have always maintained that determination deserves excellent backing.',
    'A golden result! The competitors supplied the brilliance; the rest of us shall do our best with the applause.',
    'Training, courage, and an extraordinary finish. Our champions have made national pride look wonderfully athletic.',
  ],
  city_victory: [
    'Our forces have secured the city through a formidable effort. Now our responsibility is to make this gain serve a lasting settlement.',
    'A major objective has been reached. Our troops deserve the credit, and this government intends to make their achievement count.',
    'Today brings a significant success. The next chapter requires discipline, care for civilians, and rather less ceremony than I might ordinarily prefer.',
  ],
  city_loss: [
    'The loss of this city is a grave setback. It is not the end of our capacity to recover, and I intend to demonstrate that in deeds.',
    'We have lost ground and must acknowledge it plainly. Our resolve, however, has not packed its bags.',
    'This is a hard day for our people. We will protect those affected, learn the lessons, and build the next step on firmer ground.',
  ],
  recovery: [
    'The crisis is easing. Recovery still needs work, but it is good to see daylight taking an interest in our affairs again.',
    'We have come through a difficult passage. Our people supplied the resilience, and I am proud of the part our government played.',
    'There is rebuilding ahead, but today we can lift our eyes. Hope has returned to work, and we intend to keep it employed.',
  ],
};
export const SHOWMAN_STATEMENTS: readonly LeaderStatementDefinition[] = Object.entries(pools).flatMap(([context, lines]) =>
  lines.map((text, index) => ({ id: `showman_${context}_${index}`, context: context as StatementContext,
    tone: 'theatrical' as const, requiredTrait: 'showman' as const, text })));
