/**
 * The Krueger method ad formats, full detail ported from Manos (getmanos.ai),
 * lib updated 2026-10-28. Each format has its angle, why it works, the beat-by-beat
 * structure, a fill-in template, opening hooks, a full example script, and mistakes.
 */
export type FormatBeat = { beat: string; what: string };
export type AdFormat = {
  id: string;
  name: string;
  tldr: string;
  goals: string[];
  platforms: string[];
  /** Audience awareness levels this fits: 1 unaware .. 5 most aware. */
  awareness: number[];
  production: string;
  length: string;
  why: string;
  structure: FormatBeat[];
  template: string;
  hooks: string[];
  example: string;
  mistakes: string[];
};

export const AD_FORMATS: AdFormat[] = [
  {
    "id": "contrarian-deep-dive",
    "name": "Contrarian Deep Dive",
    "tldr": "A long-form opinion piece that takes a popular trend in your market, argues against it with real reasons, and ends by showing the right way to do it.",
    "goals": [
      "controversy",
      "contrarian",
      "authority"
    ],
    "platforms": [
      "LinkedIn",
      "Facebook/Instagram feed",
      "YouTube"
    ],
    "awareness": [
      3,
      4
    ],
    "production": "Talking head",
    "length": "90-180 s",
    "why": "People pay far more attention to information that contradicts what they already believe. Breaking a popular belief creates an instant mental jolt: the viewer gets curious, feels validated if they had doubts, and opens up to a new idea. Because this format also admits what the trend gets right and offers real alternatives, it earns depth and debate instead of cheap outrage.",
    "structure": [
      {
        "beat": "Provocative hook",
        "what": "Name the behavior that became a trend and promise to explain why it is a problem."
      },
      {
        "beat": "Emotional connection",
        "what": "Share how it makes you feel and compare it to something tangible from everyday life."
      },
      {
        "beat": "Their excuses",
        "what": "List three justifications people in the market use to defend the trend."
      },
      {
        "beat": "Yes / No / It depends",
        "what": "Admit what the trend does deliver, then show what it does not."
      },
      {
        "beat": "Two mistakes",
        "what": "Explain one surface mistake and one deeper mistake, with consequences."
      },
      {
        "beat": "Name the problem",
        "what": "Paint a vivid scene or coin a memorable term for the people making the mistake."
      },
      {
        "beat": "Turn to the solution",
        "what": "Say there is a smart way to do this."
      },
      {
        "beat": "Three alternatives",
        "what": "Give three proven paths, each with a concrete example."
      },
      {
        "beat": "Red line",
        "what": "State the one limit you should never cross."
      },
      {
        "beat": "Core rules",
        "what": "Sum it up in three simple rules."
      },
      {
        "beat": "Final verdict",
        "what": "Restate the stakes in one blunt sentence."
      },
      {
        "beat": "Punchline",
        "what": "Close with a short line in the shape of: sacrifice first, reward later, in that order."
      }
    ],
    "template": "[BEHAVIOR] became the new trend in [CONTEXT].\nAnd there are [GROUP] out there [PROBLEM ACTION].\nLet me tell you why that is [STRONG NEGATIVE].\n\nI don't know about you, but I [EMOTION] when I see [SITUATION].\nIt's like [TANGIBLE ANALOGY].\n\nAnd they justify it with:\n\"Well, [EXCUSE 1]...\"\n\"Well, [EXCUSE 2]...\"\n\"Well, [EXCUSE 3]...\"\n\n[SURFACE BENEFIT]? Yes.\n[REAL BENEFIT]? No.\n[METRIC THAT MATTERS]? It depends.\nAnd that's where the danger is.\n\nTwo mistakes:\nFirst, [SURFACE MISTAKE].\nSecond, [ROOT MISTAKE].\n\nI call these people [YOUR TERM].\n\nNow, there are smart ways to [RIGHT ACTION]:\nOption 1: [EXAMPLE]\nOption 2: [EXAMPLE]\nOption 3: [EXAMPLE]\n\nBut there is one line you can't cross:\nIf you don't [CRITERION], you don't have [POSITIVE]. You have [REAL NEGATIVE].\n\nThe rule is simple:\nEvery [ACTION 1] needs [REQUIREMENT 1].\nEvery [ACTION 2] needs [REQUIREMENT 2].\nEvery [ACTION 3] needs [REQUIREMENT 3].\n\n[SACRIFICE] first. [REWARD] later. In that order.",
    "hooks": [
      "\"Work-life balance\" became every coach's favorite slogan, and it's quietly keeping you stuck.",
      "Buying a new planner every January became a ritual. Here's why it's the reason you never finish anything.",
      "Everyone in this industry is suddenly an expert at bashing the big players. Let me tell you why that's lazy.",
      "Telling people to \"burn the boats\" became a trend. I think it's terrible advice, and I'll explain.",
      "Hiring an assistant before you have a process became the norm. Here's what it really costs you."
    ],
    "example": "Cheat days became the new trend in fitness. And there are coaches out there telling busy dads they've \"earned it\" every weekend. Let me tell you why that's backwards.\n\nI don't know about you, but I cringe when I see a guy undo five good days in one Saturday. It's like bailing water out of a boat and then drilling a new hole.\n\nAnd they justify it with: \"Well, you need a mental break.\" \"Well, it keeps you consistent.\" \"Well, life is short.\"\n\nA mental break? Yes. Progress? No. Staying consistent? It depends. And that's where the danger is.\n\nTwo mistakes. First, treating food as a reward. Second, building a plan you need to escape from.\n\nI call it the Weekend Reset Trap.\n\nNow, there are smart ways to enjoy food: plan one favorite meal, not a whole day. Eat your normal breakfast before the party. Pick the dessert you actually love and skip the rest.\n\nBut here's the line you can't cross: if you need a break from your plan every week, you don't have a plan. You have a punishment.\n\nRoutine first. Treats later. In that order. Our 12-week plan for busy dads is built so you never need to escape it. Link below.",
    "mistakes": [
      "Going contrarian without solid arguments, so it reads as noise instead of insight.",
      "Attacking a specific person instead of a behavior. Use people as examples, never as targets.",
      "Skipping the alternatives section, which leaves the viewer with a complaint and no path forward.",
      "Using it on tragedies, grief, or other topics where a provocative take hurts more than it helps."
    ]
  },
  {
    "id": "business-epic-story",
    "name": "Business Epic Story",
    "tldr": "Narrate an unlikely third-party success story as a condensed hero's journey, and teach the lesson through admiration instead of opinion.",
    "goals": [
      "story",
      "authority"
    ],
    "platforms": [
      "YouTube",
      "LinkedIn",
      "Facebook/Instagram feed",
      "Reels/TikTok"
    ],
    "awareness": [
      3,
      4,
      5
    ],
    "production": "Voiceover + b-roll",
    "length": "90-180 s",
    "why": "The story opens with a paradox (how did something so unlikely become so successful?), which triggers curiosity. A condensed hero's journey builds admiration for resilience, and the success works as implied social proof: if they did it, so can you. The twist, where a disadvantage becomes the advantage, keeps people watching to the end.",
    "structure": [
      {
        "beat": "Paradox hook (0-7 s)",
        "what": "State the extraordinary result next to the unlikely starting point."
      },
      {
        "beat": "Starting point (7-30 s)",
        "what": "Introduce the main character and where they began."
      },
      {
        "beat": "Obstacles (30-70 s)",
        "what": "Stack three or more challenges, up to the moment they almost quit."
      },
      {
        "beat": "The twist (70-100 s)",
        "what": "Flash a trigger word like PLOT TWIST and reveal the counterintuitive decision."
      },
      {
        "beat": "The three tactics (100-140 s)",
        "what": "Break down the three pillars of the strategy with specific numbers."
      },
      {
        "beat": "The result (140-180 s)",
        "what": "Show where they are now and contrast before versus after."
      }
    ],
    "template": "[HOOK, on screen in caps: PARADOX PHRASE]\n\"The [UNEXPECTED PROFILE] who [UNLIKELY ACTION] and now [RESULT].\"\n\n[CONTEXT]\n\"This person [STARTING SITUATION]. They [ORIGIN]...\"\n\n[OBSTACLES]\n\"But there was a problem: [CHALLENGE 1].\nAnd that wasn't all: [CHALLENGE 2].\nTo make it worse, [CHALLENGE 3]...\"\n\n[TWIST, on screen: PLOT TWIST]\n\"That's when [COUNTERINTUITIVE DECISION]...\"\n\n[TACTICS]\n\"They did three things.\nFirst, [TACTIC 1].\nSecond, [TACTIC 2].\nThird, [TACTIC 3].\"\n\n[RESULT]\n\"Today, [CURRENT RESULT].\nFrom [BEFORE] to [AFTER].\n[FINAL NUMBER].\"\n\n[CTA: how the viewer can apply the same lesson]",
    "hooks": [
      "A 52-year-old retired teacher opened a bakery that sells only one kind of bread. It has a line around the block every Saturday.",
      "This shop sells plain white socks, and nothing else. Here's why that was genius.",
      "A tiny town team with no stars ended up playing for the regional title.",
      "A mom with zero tech background built the scheduling app every daycare in her county uses.",
      "This company was three weeks from closing. Then they raised their prices."
    ],
    "example": "[On screen: SHE RAISED PRICES TO SAVE HER BUSINESS]\nThe owner of a small cleaning company who raised her prices during a slow season, and now has a waitlist.\n\nDana ran a three-person cleaning crew in a mid-size town. She started with one van and a stack of flyers.\n\nBut there was a problem: competitors kept undercutting her. And that wasn't all: her best cleaner was about to quit over low pay. To make it worse, half her clients only booked when she ran discounts.\n\n[On screen: PLOT TWIST]\nThat's when she did the opposite of what everyone told her. She raised her prices by 30 percent.\n\nShe did three things. First, she listed exactly what was included in every visit. Second, she gave her crew a raise and told clients about it. Third, she stopped discounting, completely.\n\nToday, she has a two-week waitlist and the same crew she started with. From chasing every client to choosing them.\n\nPricing was never her problem. Not knowing her numbers was. Our bookkeeping course shows you yours in one weekend. Link below.",
    "mistakes": [
      "Telling a story without specific numbers or details, which makes it feel made up.",
      "Using it when you need to take a strong personal stance. This format teaches through someone else's story, not your opinion.",
      "Skipping the obstacles beat and jumping to the win, which kills the tension.",
      "Presenting a dramatized or composite story as a real person's results."
    ]
  },
  {
    "id": "investment-hook",
    "name": "Investment Hook",
    "tldr": "Open by stating how much time or money you invested to learn something, so the viewer feels they are getting that value for free.",
    "goals": [
      "authority",
      "curiosity"
    ],
    "platforms": [
      "YouTube Shorts",
      "Reels/TikTok",
      "Facebook/Instagram feed"
    ],
    "awareness": [
      3,
      4
    ],
    "production": "Talking head",
    "length": "20-45 s",
    "why": "It works on loss aversion: people hate missing out on something valuable more than they like gaining it. When you say you spent years or thousands of dollars to learn something, the viewer thinks the lesson is worth at least that much, and skipping the video feels like a loss. You are not just sharing information, you are transferring the value you invested.",
    "structure": [
      {
        "beat": "The investment",
        "what": "State exactly how much time, money, or repetition you put in."
      },
      {
        "beat": "The action",
        "what": "Say what you did with that investment."
      },
      {
        "beat": "The promised payoff",
        "what": "Promise a specific number of lessons, secrets, or strategies and the benefit they bring."
      },
      {
        "beat": "Deliver",
        "what": "Give the lessons, tight and concrete."
      },
      {
        "beat": "CTA",
        "what": "Point to where they can get the full version."
      }
    ],
    "template": "Weak: \"Here's what I learned about [TOPIC].\"\n\nStrong: \"I [SPENT X DOLLARS / X YEARS / DID IT X TIMES] [SPECIFIC ACTION], and these are the [NUMBER] most valuable lessons about [TOPIC] that [SPECIFIC BENEFIT].\"\n\nLesson 1: [LESSON]\nLesson 2: [LESSON]\nLesson 3: [LESSON]\n\n[CTA]",
    "hooks": [
      "I've given almost 1,000 talks. Before every single one, I do a ritual that takes all the nerves away.",
      "I spent 5 years and a small fortune on personal trainers. These are the only 3 things that actually built muscle.",
      "I've visited over 60 countries in the last decade. Here are 5 places you won't find in any guidebook.",
      "I reviewed the books of 300 small businesses. These 4 mistakes showed up in almost every one.",
      "After two failed relationships and two years of therapy, I learned these 5 truths about communication."
    ],
    "example": "I've reconciled the books for more than 300 small businesses over 9 years. These are the 3 mistakes I saw in almost every one.\n\nOne: mixing personal and business spending on the same card. It turns tax season into a treasure hunt.\n\nTwo: not setting aside tax money every time you get paid. The bill always shows up at the worst moment.\n\nThree: looking at your numbers once a year instead of once a week. By then, the problem is 12 months old.\n\nI put everything I learned into a weekend bookkeeping course for owners who hate spreadsheets. Link below.",
    "mistakes": [
      "Inventing or inflating the investment. If you can't back it up, don't use this format.",
      "Using it with an audience that already knows you well, where it starts to sound repetitive.",
      "Citing an investment that doesn't impress your specific audience.",
      "Overpromising in the hook and then delivering generic tips."
    ]
  },
  {
    "id": "react-plus-research",
    "name": "React + Research",
    "tldr": "React to a video that is already viral in your niche, open a curiosity gap with a question, then bring in a study or researcher to answer it.",
    "goals": [
      "authority",
      "curiosity"
    ],
    "platforms": [
      "YouTube Shorts",
      "Reels/TikTok"
    ],
    "awareness": [
      3
    ],
    "production": "Talking head",
    "length": "30-60 s",
    "why": "It stacks three triggers. The viral clip carries social validation, since lots of people already watched it. The question opens a loop the viewer wants closed. And citing a study borrows credibility from a trusted source. You take a hook that already works and add suspense plus evidence.",
    "structure": [
      {
        "beat": "Viral clip",
        "what": "Show a short piece of a video that already went viral in your niche."
      },
      {
        "beat": "Reaction + question",
        "what": "React and ask a curious question about the claim."
      },
      {
        "beat": "Third-party authority",
        "what": "Bring in a study, institution, or statistic that set out to answer it."
      },
      {
        "beat": "The answer",
        "what": "Share what they found and what it means for the viewer."
      },
      {
        "beat": "CTA",
        "what": "Tie the finding to your offer."
      }
    ],
    "template": "[Show the viral video]\n\n\"[REACTION TO THE VIDEO]? [CURIOUS QUESTION ABOUT THE TOPIC]\n\nWell, researchers at [RESPECTED INSTITUTION] wanted to find out...\n\n[WHAT THEY DID]. [WHAT THEY FOUND].\n\nSo what does that mean for you? [TAKEAWAY].\n\n[CTA]",
    "hooks": [
      "Seriously? You burned 1,500 calories in one hour? How accurate are those smartwatches, really?",
      "She's right. Your metabolism isn't slowing down. But something else might be.",
      "Does how long you rest between sets actually matter? Probably more than you think.",
      "Does waking up at 5 a.m. really make you more productive? The answer might surprise you.",
      "Does intermittent fasting speed up your metabolism? The research says something very different."
    ],
    "example": "[Viral clip: a guy says he burned 1,500 calories in a one-hour workout]\n\nSeriously? 1,500 calories in an hour? How accurate are those watches, really?\n\nWell, researchers have actually tested this. They put popular fitness trackers on volunteers and compared them to lab equipment. The heart rate numbers were close. The calorie numbers were way off.\n\nSo if your watch says you earned a burger, it might be lying to you.\n\nThat's why our coaching program for busy dads tracks the things you can actually control: workouts done, protein eaten, steps walked. Link below.",
    "mistakes": [
      "Reacting to a video that didn't perform. You're borrowing a hook that already proved it doesn't work.",
      "Citing a study you can't point to. Never make up the research or the numbers.",
      "Forcing an exaggerated reaction that comes off as clickbait."
    ]
  },
  {
    "id": "result-scene-vehicle",
    "name": "Result, Scene, Vehicle (RSV)",
    "tldr": "Don't just state the result, describe what it feels like to live it, then name the method that gets them there.",
    "goals": [
      "curiosity",
      "conversion"
    ],
    "platforms": [
      "Reels/TikTok",
      "Facebook/Instagram feed"
    ],
    "awareness": [
      1,
      2
    ],
    "production": "Voiceover + b-roll",
    "length": "15-40 s",
    "why": "Naming a result is information. Describing the experience of living that result makes the viewer picture themselves in the scene, which is far more engaging. The difference between an ad people scroll past and one they stop for is often not the information, it's making them feel the transformation before they want the method.",
    "structure": [
      {
        "beat": "Result",
        "what": "Know the outcome the viewer wants."
      },
      {
        "beat": "Scene",
        "what": "Describe a specific, sensory moment of living that outcome."
      },
      {
        "beat": "Vehicle",
        "what": "Name the method, system, or product that gets them there."
      },
      {
        "beat": "CTA",
        "what": "Invite them to get the vehicle."
      }
    ],
    "template": "Option A: \"Imagine [SPECIFIC, SENSORY SCENE OF THE RESULT]. This is [THE VEHICLE] that lets you do exactly that.\"\n\nOption B: \"If you want [RESULT + SCENE OF WHAT IT FEELS LIKE], then [THE VEHICLE].\"\n\nWeak: \"How to [RESULT].\"\nStrong: \"Imagine [SCENE]. Here's the [VEHICLE] I use.\"\n\n[CTA]",
    "hooks": [
      "Imagine: it's only 10 a.m. and your content for the whole month is already done. This is the exact system I use.",
      "Imagine slipping into the jeans that haven't fit in three years, and hearing \"you look different\" from people you haven't seen in months.",
      "Imagine looking at your account at the end of the year and finding money you didn't notice you were saving.",
      "Imagine coming home after a rough day and your partner knowing exactly what you need without you explaining.",
      "Imagine pulling a cake out of the oven, the smell filling the house, and your family running into the kitchen. This is the 3-ingredient recipe."
    ],
    "example": "Imagine it's Sunday morning. Your kid wants to race you to the end of the block, and for the first time in years, you actually win. You're not out of breath. You're laughing.\n\nThat's what 20 minutes a day did for the dads in our program. No gym, no 5 a.m. alarm. Just a plan built around your real schedule.\n\nTap the link and get week one free.",
    "mistakes": [
      "Describing a scene that sounds exaggerated or fake, which breaks trust.",
      "Using it for a result that's too technical to turn into a sensory moment.",
      "Painting the scene and never naming the vehicle, so the viewer doesn't know what to do next.",
      "Leaning on it with a very skeptical audience, where a dreamy scene can feel manipulative."
    ]
  },
  {
    "id": "build-in-public-journey",
    "name": "Build-in-Public Journey",
    "tldr": "If you're just starting, don't fake authority: turn your growth into a live series with a public goal and invite people to follow along.",
    "goals": [
      "following",
      "story"
    ],
    "platforms": [
      "Reels/TikTok",
      "Facebook/Instagram feed",
      "YouTube Shorts"
    ],
    "awareness": [
      1,
      2
    ],
    "production": "Talking head",
    "length": "15-45 s per episode",
    "why": "People are wired to root for the underdog. Showing what you are achieving right now feels closer and more relatable than a finished success story, and promising to share everything creates a sense of reciprocity. Stories in progress hook people more than finished ones, the same way a series is more addictive than a movie.",
    "structure": [
      {
        "beat": "Public goal",
        "what": "State a specific, measurable goal with a deadline."
      },
      {
        "beat": "What you'll document",
        "what": "Promise to share everything you do along the way, wins and mistakes."
      },
      {
        "beat": "Invitation",
        "what": "Invite people to follow and grow with you, as a collaborator, not a teacher."
      },
      {
        "beat": "Episode update",
        "what": "In each video, report where you are, what worked, and what didn't."
      }
    ],
    "template": "[SPECIFIC GOAL] in [DEADLINE].\nI'm going to share [WHAT YOU'LL DOCUMENT].\nFollow along and [GROW / LEARN] with me.\n\nEpisode format:\n\"Day [X] of [GOAL]. Here's where I am: [STATUS]. What worked: [WIN]. What didn't: [MISS]. Tomorrow I'm trying [NEXT STEP].\"\n",
    "hooks": [
      "0 to 10,000 followers in 30 days. I'm going to share everything I do. Follow along.",
      "Losing 30 pounds in 6 months. I'll show the workouts, the meals, and the slip-ups.",
      "100 perfect recipes in 100 days. Messing up, adjusting, and sharing all of it.",
      "4 hours of focused work a day, every day for 30 days. Testing every technique out there.",
      "Day 12 of paying off my credit card. Here's what I cut this week."
    ],
    "example": "Day 1. I'm a dad of three, I work 50 hours a week, and I'm going to lose 20 pounds in 90 days without a gym.\n\nI'm going to share every workout, every meal, and every time I mess up.\n\nToday's workout was 18 minutes in the garage while the kids watched cartoons. Tomorrow, I'm trying it before breakfast.\n\nIf you're a busy dad who wants to get back in shape, follow along and do it with me. The plan I'm using is linked below.",
    "mistakes": [
      "Promising to teach instead of promising to share or document. The difference is small but it matters.",
      "Setting a vague goal that can't be tracked, so there's no tension.",
      "Using it when you already have established authority, which comes off as false modesty.",
      "Not actually documenting the journey, which breaks trust fast."
    ]
  },
  {
    "id": "belief-flip",
    "name": "Belief Flip",
    "tldr": "Deny a popular belief, validate the viewer's frustration with it, then reveal the deeper truth they were missing, backed by evidence.",
    "goals": [
      "controversy",
      "contrarian",
      "curiosity"
    ],
    "platforms": [
      "Facebook/Instagram feed",
      "Reels/TikTok"
    ],
    "awareness": [
      2
    ],
    "production": "Talking head",
    "length": "30-60 s",
    "why": "Contradicting an established belief creates instant cognitive dissonance: \"what do you mean it doesn't work?\" At the same time, the viewer feels validated (\"I knew something was off\") and becomes open to new information. The brain needs to resolve that tension, like a door left half open. The key is not to fully deny the belief but to add a deeper layer people ignore.",
    "structure": [
      {
        "beat": "Contradicting hook",
        "what": "Say a popular strategy doesn't work unless one ignored element is in place."
      },
      {
        "beat": "Emotional validation",
        "what": "Ask if they've felt this too."
      },
      {
        "beat": "Evidence",
        "what": "Show data or logic that proves your point."
      },
      {
        "beat": "New framework",
        "what": "Give the real solution nobody talks about."
      },
      {
        "beat": "Proof or example",
        "what": "Tell a short story that shows it working."
      },
      {
        "beat": "Soft CTA",
        "what": "Invite them to make the change."
      }
    ],
    "template": "Weak: \"[POPULAR ADVICE].\"\n\nStrong:\n\"[POPULAR STRATEGY] doesn't work if [IGNORED ELEMENT].\n\nHave you ever felt [FRUSTRATION]?\n\nThe truth? [IGNORED ELEMENT] matters more than [POPULAR STRATEGY].\n\n[EVIDENCE OR STUDY].\n\nWhen you [RIGHT ACTION], [RESULT].\n\n[SHORT EXAMPLE]\n\n[SOFT CTA]",
    "hooks": [
      "Positive thinking is useless if your gut is telling you the opposite. And I'll prove it.",
      "Waking up at 5 a.m. without matching your body clock isn't discipline. It's self-sabotage.",
      "Communicating more won't fix your relationship if you can't calm down first.",
      "Posting every day doesn't pay off if your message doesn't land.",
      "Validating your idea for six months isn't caution. It's expensive procrastination."
    ],
    "example": "Drinking more water won't fix your skin if you're stripping it every morning.\n\nHave you ever bought every serum on the shelf and still woken up dry and red?\n\nHere's the thing: most people wash their face with a cleanser that's harsher than their skin can handle. Then they spend the rest of the day trying to put back what they washed off.\n\nWhen you switch to a gentle cleanser and stop scrubbing, your skin can finally hold on to moisture.\n\nThat's why our starter kit begins with the cleanser, not the serum. Try it for 30 days and see the difference.",
    "mistakes": [
      "Flipping a belief that's actually correct, just to be provocative.",
      "Making the claim without any evidence, which sounds arrogant.",
      "Fully denying the belief instead of adding the missing layer. Reorganize priorities, don't trash everything.",
      "Inventing statistics to back up the flip."
    ]
  },
  {
    "id": "unfair-advantage-of-fun",
    "name": "Unfair Advantage of Fun",
    "tldr": "Show that you can't compete with someone who genuinely enjoys the work, turning a \"weakness\" (loving the process) into an unfair edge.",
    "goals": [
      "contrarian",
      "following"
    ],
    "platforms": [
      "Reels/TikTok",
      "Facebook/Instagram feed"
    ],
    "awareness": [
      2
    ],
    "production": "Voiceover + b-roll",
    "length": "20-45 s",
    "why": "We've been conditioned to separate work from pleasure and to believe results require suffering. Saying \"you can't compete with someone who's having fun\" flips that. It creates positive envy (\"I wish I were like that\"), curiosity (\"is that really possible?\"), and a desire to belong to that group. People hate feeling at an unfair disadvantage, so when you reveal a cheat code, they need to know more.",
    "structure": [
      {
        "beat": "Impossibility",
        "what": "Say you'll never beat a certain kind of person."
      },
      {
        "beat": "The special group",
        "what": "Reveal that there are people who genuinely enjoy the thing most people hate."
      },
      {
        "beat": "Counterintuitive proof",
        "what": "Give an example that sounds almost absurd."
      },
      {
        "beat": "Objection",
        "what": "Acknowledge it sounds crazy."
      },
      {
        "beat": "Reframe",
        "what": "Offer a new way to see the work."
      },
      {
        "beat": "Invitation",
        "what": "Ask: what if you could enjoy it too?"
      }
    ],
    "template": "You'll never beat [PERSON WHO DOES X FOR FUN].\n\nYes, there are people who [COUNTERINTUITIVE ACTION].\n\n[PROVOCATIVE RHETORICAL QUESTION]?\n\nI know it sounds crazy, but [REVELATION ABOUT REAL MOTIVATION].\n\n[STORY OR EXAMPLE THAT PROVES IT].\n\nMaybe [NEW MINDSET] is the answer. [INVITATION / CTA]",
    "hooks": [
      "You'll never beat the person who looks at spreadsheets for fun.",
      "It's impossible to compete with someone who tests 15 versions of a sauce on a Sunday just because they love it.",
      "You lose to the guy who spends six hours planning a trip route for pleasure.",
      "You'll never outwork the salesperson who actually enjoys hearing no.",
      "Some people would rather do leg day than go to a barbecue. You can't beat them. But you can join them."
    ],
    "example": "You'll never beat the business owner who gets excited about doing her books.\n\nYes, there are people who open their numbers on a Friday night because they want to.\n\nCrazy? Maybe. But here's what they know: when you understand your numbers, every decision gets easier. It stops being a chore and starts being a game you're winning.\n\nThe difference isn't talent. It's that someone showed them how to read the scoreboard.\n\nOur weekend bookkeeping course makes your numbers make sense, maybe even fun. Link below.",
    "mistakes": [
      "Using it on an audience that's already burned out, where it can feel discouraging.",
      "Not having a real example of the \"special group.\"",
      "Sounding elitist or mocking people who don't enjoy the work.",
      "Picking an activity most people already enjoy. Choose something 90 percent hate and 10 percent love."
    ]
  },
  {
    "id": "contrarian-hook",
    "name": "Contrarian Hook",
    "tldr": "A short, punchy challenge to a common belief that acknowledges the belief first, then flips it with one specific condition.",
    "goals": [
      "contrarian",
      "controversy",
      "curiosity"
    ],
    "platforms": [
      "Reels/TikTok",
      "LinkedIn",
      "YouTube Shorts"
    ],
    "awareness": [
      2,
      3
    ],
    "production": "Talking head",
    "length": "15-30 s",
    "why": "Challenging an established belief stops people mid-scroll, because people love to be right. When someone says everyone is wrong about something, the viewer switches into defense or curiosity mode, and either way they keep watching. It also gives intellectual validation: \"I always knew something was off.\" The specific condition is what adds nuance and keeps you from sounding reckless.",
    "structure": [
      {
        "beat": "The belief",
        "what": "Name what most people say about the topic."
      },
      {
        "beat": "The flip",
        "what": "Say the opposite is actually true."
      },
      {
        "beat": "The condition",
        "what": "Add: but only if a specific condition is met."
      },
      {
        "beat": "The reason",
        "what": "Explain the logic in one or two lines."
      },
      {
        "beat": "The benefit",
        "what": "Say what this will change for the viewer."
      }
    ],
    "template": "Weak: \"Tips for [TOPIC].\"\n\nStrong:\n\"Contrary to what [AUTHORITY / MOST PEOPLE] say,\n[CONTROVERSIAL ACTION] is actually [BENEFIT],\nbut ONLY when [SPECIFIC CONDITION].\nBecause [LOGICAL REASON].\n[WHAT IT CHANGES FOR YOU].\"\n",
    "hooks": [
      "Contrary to what everyone says, don't create an online course yet. Sell a service first.",
      "Forget waking up at 5 a.m. Work during your biological peak, even if that's 11 p.m.",
      "Stop \"just being yourself.\" Be the best version of yourself.",
      "Frozen fruit is better than fresh for smoothies, as long as it's frozen at peak ripeness.",
      "Stop spreading your savings across 20 things you don't understand."
    ],
    "example": "Contrary to what most fitness coaches say, you don't need to work out every day. Three days a week is better, but only if every session is focused and progressive. Because a busy dad who shows up three times and pushes harder each week beats the guy who wanders through seven half-hearted workouts. Our plan is built for exactly three days. Link below.",
    "mistakes": [
      "Leaving out the condition, which makes the claim sound irresponsible.",
      "Being contrarian just for the drama, with nothing behind it.",
      "Attacking the belief head on instead of acknowledging it first and then flipping it.",
      "Stretching it into a long video. For the long version, use the Contrarian Deep Dive."
    ]
  },
  {
    "id": "weird-flex",
    "name": "Weird Flex",
    "tldr": "Turn a supposedly negative trait into a superpower, and celebrate the people who are different as the ones who win.",
    "goals": [
      "following",
      "contrarian"
    ],
    "platforms": [
      "Reels/TikTok",
      "Facebook/Instagram feed"
    ],
    "awareness": [
      1,
      2
    ],
    "production": "Voiceover + b-roll",
    "length": "10-30 s",
    "why": "It plays on the underdog effect and the desire to feel unique. Everyone secretly wants to be special, and society preaches conformity while rewarding originality. This format resolves that tension: it validates the viewer's identity and gives them permission to be themselves, plus hope of succeeding that way.",
    "structure": [
      {
        "beat": "The \"negative\" trait",
        "what": "Name the trait people are usually told to fix."
      },
      {
        "beat": "The flip",
        "what": "Say it's exactly what gets them the result they want."
      },
      {
        "beat": "Visual or social proof",
        "what": "Show results, examples, or screenshots that back it up."
      },
      {
        "beat": "Reinforcement",
        "what": "Contrast: while the normal ones do X, the different ones get Y."
      }
    ],
    "template": "Weak: \"[CONVENTIONAL ADVICE].\"\n\nStrong:\n\"Keep being [WEIRD TRAIT].\nBecause the [WEIRD TRAIT] ones\nare the ones who [RESULT].\nWhile the [NORMAL ONES] [MEDIOCRE ACTION].\"\n\n[Montage of visual proof]\n[CTA]",
    "hooks": [
      "Keep being the \"lazy\" one at the gym. Three focused workouts a week beat seven on autopilot.",
      "Keep reading \"slowly.\" The person who reads 3 books and applies them beats the one who reads 50 and forgets them.",
      "Keep posting \"wrong.\" The ones who break the rules are the ones people remember.",
      "Keep making \"ugly\" art. Ugly art is the kind people stop scrolling for.",
      "Keep being the one who asks too many questions. That's why you never get fooled."
    ],
    "example": "Keep being the dad who leaves the party early to go to bed.\n\nBecause the dads who protect their sleep are the ones with energy on Saturday morning.\n\n[Montage: dad up early making pancakes, playing catch, finishing a workout in the driveway]\n\nWhile everyone else is running on coffee, you're running with your kids.\n\nOur 20-minute plan for busy dads starts with sleep. Link below.",
    "mistakes": [
      "Skipping the proof. Saying it isn't enough; you have to show it, because the visual proof carries most of the weight.",
      "Romanticizing a trait that's actually harmful.",
      "Making it sound like an excuse for mediocrity.",
      "Using famous people as proof without being able to back up the claim."
    ]
  },
  {
    "id": "behind-the-scenes-chaos",
    "name": "Behind-the-Scenes Chaos",
    "tldr": "Say the serious, impressive goal is the easy part, and show that the real challenge is everyday human chaos.",
    "goals": [
      "story",
      "following"
    ],
    "platforms": [
      "Reels/TikTok",
      "Facebook/Instagram feed"
    ],
    "awareness": [
      4,
      5
    ],
    "production": "UGC",
    "length": "15-45 s",
    "why": "People are tired of fake perfection. Admitting that the professional part is easy and the human mess is the hard part feels real and relatable. It relieves the pressure to be perfect, creates genuine connection, and quietly proves that if they can do it in that chaos, the viewer can too. It's anti-guru: it flips the hierarchy of difficulty.",
    "structure": [
      {
        "beat": "The easy part",
        "what": "Say the big, impressive goal is easy."
      },
      {
        "beat": "The hard part",
        "what": "Say the real challenge is a specific, ridiculous human problem."
      },
      {
        "beat": "Chaotic attempt",
        "what": "Show the messy attempt to deal with it."
      },
      {
        "beat": "More chaos",
        "what": "Escalate with more confusion, interruptions, or arguments."
      },
      {
        "beat": "Simple fix",
        "what": "Resolve it with something absurdly simple."
      },
      {
        "beat": "The moral",
        "what": "Land a real lesson disguised as a joke."
      }
    ],
    "template": "[BIG GOAL] is easy.\n\nThe hard part is [SPECIFIC EVERYDAY PROBLEM].\n\n[Show the chaotic attempt to deal with it]\n[More chaos]\n\nSolution: [SOMETHING SUPER SIMPLE].\n\nMoral: [REAL INSIGHT].\n[CTA]",
    "hooks": [
      "Running a marathon is easy. The hard part is tying your shoes at 5 a.m. with the cat climbing on your back.",
      "Baking a wedding cake is easy. The hard part is whipping egg whites while your kid asks why you don't use real snow.",
      "Going viral is easy. The hard part is filming with 2 percent battery while your grandma walks in asking who you're talking to.",
      "Closing a big client is easy. The hard part is presenting on Zoom while your cat walks across the keyboard.",
      "Launching a product is easy. The hard part is recording the video while the neighbor is drilling through the wall."
    ],
    "example": "Getting back in shape is easy.\n\nThe hard part is working out in the living room with three kids who think you're a jungle gym.\n\n[Dad starts push-ups. Toddler climbs on his back. Middle kid turns on loud music. Dog steals his water bottle.]\n\n[He tries squats. Oldest kid starts counting them out loud, wrong.]\n\nSolution: let the toddler ride. Push-ups with a 25-pound backpack.\n\nMoral: you don't need a quiet hour. You need a plan that works in the chaos. Ours is linked below.",
    "mistakes": [
      "Faking the chaos. Staged mess looks fake and kills the point.",
      "Using it for a problem that's actually serious, which trivializes it.",
      "Using it for an audience that expects polished, formal content.",
      "Forgetting the moral, so it's just a funny clip with no reason to click."
    ]
  },
  {
    "id": "secret-system",
    "name": "Secret System",
    "tldr": "Reveal a hidden system insiders use to classify people, and show the viewer a mechanism they didn't know existed.",
    "goals": [
      "curiosity",
      "authority"
    ],
    "platforms": [
      "YouTube Shorts",
      "Facebook/Instagram feed",
      "Reels/TikTok"
    ],
    "awareness": [
      3
    ],
    "production": "Voiceover + b-roll",
    "length": "20-45 s",
    "why": "People are hooked on information that feels secret or exclusive, which is why gossip spreads. Finding out you missed something obvious stings and makes you curious at the same time. Promising to reveal a hidden system taps fear of missing out and the desire to belong to the group that knows. The best secrets feel obvious after they're explained but nobody noticed them before.",
    "structure": [
      {
        "beat": "Context",
        "what": "Set a specific place or situation."
      },
      {
        "beat": "The system",
        "what": "Reveal that insiders there use a hidden system."
      },
      {
        "beat": "The classification",
        "what": "Explain how behavior A gets you label A and behavior B gets you label B."
      },
      {
        "beat": "Consequence",
        "what": "Show what that label means for the viewer."
      },
      {
        "beat": "Universal lesson",
        "what": "Generalize and give a subtle CTA."
      }
    ],
    "template": "Weak: \"Tips for [TOPIC].\"\n\nStrong:\n\"In [SPECIFIC PLACE OR CONTEXT], there's a [SYSTEM] that [INSIDER GROUP] uses to [SECRET ACTION].\n\nIf you [BEHAVIOR A], they mark you as [LABEL A].\nIf you [BEHAVIOR B], they mark you as [LABEL B].\n\n[THE CONSEQUENCE]\n\nIt's like this in [GENERALIZATION], so you need to [SUBTLE CTA].\"\n",
    "hooks": [
      "The secret colored-bag system market vendors use to size you up the moment you walk in.",
      "Some restaurants have a code on your ticket that decides whether the server pushes dessert.",
      "Suppliers often have three prices: first contact, negotiator, and real partner. Which one are you getting?",
      "Your gym already sorted you into one of three groups the day you signed up.",
      "There's a label on your customer file, and it follows you into every call."
    ],
    "example": "Most gyms quietly sort new members into three groups in the first month.\n\nIf you show up five times the first week and then disappear, you're a resolution. If you come once and never return, you're a donation. If you show up two or three times a week, every week, you're a regular.\n\nThe gym plans its whole business around most people becoming donations.\n\nThat's true for almost every fitness plan out there. So pick one built to keep you a regular. Our 20-minute plan for busy dads is. Link below.",
    "mistakes": [
      "Inventing or exaggerating the \"secret.\" Only reveal systems that really exist.",
      "Revealing something that's already common knowledge.",
      "Unfairly harming or demonizing a specific group.",
      "Stopping at the reveal without the universal lesson or a reason to act."
    ]
  },
  {
    "id": "cartoon-psychology-lesson",
    "name": "Cartoon Psychology Lesson",
    "tldr": "A narrated stick-figure cartoon that teaches one named psychology effect with a real historical experiment, then reveals the product as the place that hands people ideas like that.",
    "goals": [
      "curiosity",
      "authority",
      "conversion"
    ],
    "platforms": [
      "Reels/TikTok",
      "Facebook/Instagram feed",
      "YouTube Shorts"
    ],
    "awareness": [
      1,
      2
    ],
    "production": "Animated",
    "length": "75-95 s",
    "why": "For most of its runtime it reads as content, not an ad, so attention comes from curiosity rather than the offer. The lesson is the demo: the viewer has just experienced getting handed a great idea, so the product reveal feels earned. Concrete numbers and a date make it credible, the cartoon makes it easy to watch, and the line \"not because you're not smart\" removes shame and gives the viewer an identity.",
    "structure": [
      {
        "beat": "Paradox hook (0-10 s)",
        "what": "Show a simple scenario with a counterintuitive twist."
      },
      {
        "beat": "Name it (10-13 s)",
        "what": "Say: in psychology, they call this the [NAME] effect."
      },
      {
        "beat": "The principle (14-27 s)",
        "what": "Explain why with three or four short aphorism lines that escalate."
      },
      {
        "beat": "The proof (28-47 s)",
        "what": "Tell a real historical experiment with a year, a person, and exact numbers, then a punch line."
      },
      {
        "beat": "The turn (47-55 s)",
        "what": "Most people never learn this, not because they're not smart, but because nobody ever hands it to them."
      },
      {
        "beat": "Product reveal (55-71 s)",
        "what": "That's what [PRODUCT] is for: what it looks like and how it works in one breath."
      },
      {
        "beat": "What it's not (71-74 s)",
        "what": "Say what the product is not, in one short line."
      },
      {
        "beat": "Proof stat (74-80 s)",
        "what": "Give one simple, true usage stat."
      },
      {
        "beat": "Identity + CTA (80-90 s)",
        "what": "Some call it the [X] for people who [Y]. It's called [PRODUCT]. Try it now."
      }
    ],
    "template": "[HOOK] [SIMPLE SCENARIO]. [COUNTERINTUITIVE TWIST].\n\nIn psychology, they call this the [NAME] effect.\n\n[APHORISM 1]. [APHORISM 2]. [APHORISM 3, ESCALATING].\n\nIn [YEAR], [PERSON / ROLE] [RAN THIS EXPERIMENT]. [EXACT NUMBER A]. [EXACT NUMBER B].\n[PUNCH LINE].\n\nMost people go their whole life without knowing [THIS]. Not because they're not smart. Because nobody ever hands them [THIS KIND OF IDEA].\n\nThat's what [PRODUCT] is for. [WHAT IT LOOKS LIKE + HOW IT WORKS, ONE BREATH].\nIt's not [WHAT IT ISN'T].\nThe average person here [TRUE, MODEST USAGE STAT].\n\nSome call it the [X] for people who [Y]. It's called [PRODUCT]. Try it now.\n\nProduction notes: one simple cartoon frame per line (2-4 s cuts), calm documentary-style narrator, quiet music bed, one bold caption word on screen at a time. Put all numbers and names on designed text cards, never inside generated images.",
    "hooks": [
      "One man pulls a rope with everything he has. Put him on a team of eight, and he gives half. But he swears he gave everything.",
      "Ask a crowd to guess the weight of an ox and almost everyone is wrong. Average their guesses, and they're almost exactly right.",
      "You remember the task you didn't finish far better than the one you did.",
      "Give people more options, and fewer of them buy anything at all.",
      "Tell someone a goal out loud, and they become a little less likely to reach it."
    ],
    "example": "One man pulls a rope with everything he has. Put him with seven other men, and he gives half. But ask him, and he swears he gave everything.\n\nIn psychology, they call this the Ringelmann effect.\n\nThe bigger the group, the easier it is to hide. The easier it is to hide, the less each person pushes. And nobody notices it happening, least of all themselves.\n\nIn 1913, a French agricultural engineer named Max Ringelmann measured men pulling on a rope. Alone, a man pulled about 63 kilos. On a team of eight, each one pulled about 31.\n\nSame rope. Same man. Half the strength. And he never felt it go.\n\nMost teams run like this for years. Not because the people are lazy. Because nobody ever shows them who's pulling what.\n\nThat's what Ropeboard is for. Every project gets split into named pieces, so every person can see their own rope.\nIt's not a surveillance tool. Nobody tracks hours or keystrokes.\nTeams here usually set it up in an afternoon.\n\nSome call it the scoreboard for teams that hate meetings. It's called Ropeboard. Try it free.",
    "mistakes": [
      "Inventing the study or the numbers. Use a real, verifiable experiment or don't use the format.",
      "Revealing the product too early, which turns the lesson into an obvious ad.",
      "Letting the image generator draw numbers or names, which come out garbled. Put them on designed text cards.",
      "Cloning a real narrator's voice instead of matching the tone with a stock voice."
    ]
  },
  {
    "id": "animated-musical-story",
    "name": "Animated Musical Story (Pixar-style)",
    "tldr": "A 3D animated story ad where a song narrates the plot while the character silently lives it: a relatable struggle, failed attempts, the discovery, and a reward scene.",
    "goals": [
      "story",
      "conversion"
    ],
    "platforms": [
      "Reels/TikTok",
      "Facebook/Instagram feed",
      "YouTube Shorts"
    ],
    "awareness": [
      1,
      2,
      3
    ],
    "production": "Animated",
    "length": "45-120 s",
    "why": "It opens on a tension the viewer recognizes in the first three seconds, like a rival living the dream while the hero fights the exact pain of the category, so the ideal customer sees themselves in a specific action, tool, or situation. Envy, pride, frustration, or the wish for comfort or control can all be the creative lens. The reward scene repeats an earlier moment with a different ending, which makes the transformation obvious without explaining it, and a catchy chorus ties the product to the benefit.",
    "structure": [
      {
        "beat": "Hook",
        "what": "A specific conflict plus curiosity, readable even with the sound off."
      },
      {
        "beat": "The dream",
        "what": "Why the hero started in the first place."
      },
      {
        "beat": "Attempts",
        "what": "Solutions they try that only create more work."
      },
      {
        "beat": "Escalation",
        "what": "Money, time, attention, or opportunities being eaten up."
      },
      {
        "beat": "Human cost",
        "what": "One concrete moment the hero misses because of the problem."
      },
      {
        "beat": "Discovery",
        "what": "The solution enters without a long explanation."
      },
      {
        "beat": "Mechanism",
        "what": "Show how the product changes the way things work."
      },
      {
        "beat": "Reward",
        "what": "Replay the earlier moment with a different ending."
      },
      {
        "beat": "CTA",
        "what": "A clear next step that matches where the click goes."
      }
    ],
    "template": "Lyrics (sung; the character acts it out silently, no lip sync):\n\n[Hook]\n[RIVAL] is [LIVING THE DREAM], while I'm [STUCK IN THE SPECIFIC PAIN]\n\n[Verse 1: the dream and the attempts]\nI started out to [DREAM]\nTried [ATTEMPT 1], then [ATTEMPT 2]\nEvery fix just meant [MORE WORK]\n\n[Verse 2: escalation and human cost]\n[TIME / MONEY / ATTENTION] slipping away\nMissed [CONCRETE MOMENT] again today\n\n[Chorus: identity line]\n[LINE THE IDEAL CUSTOMER RECOGNIZES]\n\n[Turn: discovery + mechanism]\nThen I found [PRODUCT], it [HOW IT WORKS, SHOWN ON SCREEN]\n\n[Final chorus: product + benefit]\n[PRODUCT TIED TO BENEFIT]\n\n[End card] [CTA]\n\nProduction notes: about one shot per sung phrase (roughly 4 s each). Lock the character's face, outfit, and props before animating. Use real product captures for screens and label dramatizations as dramatizations.",
    "hooks": [
      "[Song] My neighbor's in the best shape of his life, and I'm out of breath on the stairs.",
      "[Song] She closed her laptop at five. I'm still here at nine.",
      "[Song] Every receipt I own lives in a shoebox, and the shoebox is winning.",
      "[Song] My friend's skin glows in every photo. Mine glows too, but only on the forehead.",
      "[Song] The other dads are running. I'm the one holding everybody's jackets."
    ],
    "example": "[Hook] (Dad on the sideline of a kids' soccer game, holding jackets while another dad jogs past with the team)\n\"The other dads are running, I'm holding everybody's coats\"\n\n[Verse 1] (Flashback: he signs up for a gym, then the card collects dust; a fancy rowing machine becomes a clothes rack)\n\"I swore this year I'd get back in the game\nSigned up for the gym, but my schedule stayed the same\nBought a shiny machine, now it's holding up my shirts\"\n\n[Verse 2] (Late nights at the laptop, snack wrappers piling up; his son waves from the field and he's too winded to jog over)\n\"Long days, late nights, the snacks just pile up high\nMy boy yelled 'Dad, come play,' and I just waved goodbye\"\n\n[Chorus]\n\"I'm not lazy, I'm just stretched too thin\"\n\n[Turn] (Phone screen shows a simple 20-minute plan; he does a quick workout in the garage while the kids watch)\n\"Then I found a plan that fits between the lines\nTwenty minutes in the garage, right on time\"\n\n[Final chorus] (Same soccer field, weeks later: he's jogging with the team, his son high-fives him)\n\"Twenty minutes, and I'm back in the game\"\n\n[End card] \"Click the link below to start week one free.\"",
    "mistakes": [
      "Hiding the product until the last few seconds or skipping the mechanism. Give the 'how it works' real screen time.",
      "Filling time by repeating the same pain instead of moving the story forward.",
      "Inventing features, testimonials, or results, or presenting dramatized scenes as real footage.",
      "Letting the character sing or lip-sync when the format calls for the song to narrate while the character acts."
    ]
  }
];

export const GOALS = ["authority", "contrarian", "controversy", "conversion", "curiosity", "following", "story"] as const;
export const PRODUCTION_STYLES = ["Animated", "Talking head", "UGC", "Voiceover + b-roll"] as const;
export const PLATFORMS = ["Facebook/Instagram feed", "LinkedIn", "Reels/TikTok", "YouTube", "YouTube Shorts"] as const;
export const AWARENESS_LABELS: Record<number,string> = {1:"Unaware",2:"Problem aware",3:"Solution aware",4:"Product aware",5:"Most aware"};

export type HookType = { name: string; when: string; example: string };

/** Opening hook types used across the formats (who they fit + an example line). */
export const HOOK_TYPES: HookType[] = [
  { name: "Question", when: "Viewers who already know the problem; use a question they can't help answering in their head.", example: "Did you see the guy on the news who cleaned out his garage in one afternoon?" },
  { name: "Counterintuitive claim", when: "People who already tried other solutions; it breaks what they believe.", example: "If you're still dieting, you're behind." },
  { name: "Secret reveal", when: "Cold to warm audiences that respond to insider knowledge.", example: "There's a trick for [RESULT] that almost nobody uses." },
  { name: "Number or result", when: "People who already know you or the offer; it works as proof.", example: "I cut my grocery bill by $200 a month without clipping a single coupon." },
  { name: "First-person story", when: "Cold audiences who don't know about the problem yet; a story pulls them in.", example: "How I wasted a whole year on a launch nobody bought." },
  { name: "Third-person story", when: "Warm audiences that need proof from someone like them.", example: "My cousin tried it and people keep asking what changed." },
  { name: "Audience callout", when: "Viewers who know the problem; naming them makes them stop.", example: "Moms whose kids are glued to their phones..." },
  { name: "Pain identification", when: "Viewers who know the problem and feel it right now.", example: "If your ad costs keep going up and your sales keep going down..." },
  { name: "News or new release", when: "Cold audiences, or people who already know you and want what's new.", example: "This workshop that used to cost $40 is now free." },
  { name: "Challenge or quiz", when: "Any temperature; it turns the viewer into a participant.", example: "Which of these 3 makes you [X]? The right answer isn't the one you think." },
  { name: "Before-and-after comparison", when: "People who already tried solutions and are tired of failing.", example: "Creams, masks, expensive serums, I tried it all. Only this worked." },
  { name: "Common enemy", when: "People who already tried solutions; point at a villain in the industry, never at the viewer.", example: "The [X] industry profits from you staying stuck like this." },
  { name: "Visual proof", when: "When the result can be seen; show it before you say a word.", example: "Open on the screen, the result, or the product in hand, then start talking." },
  { name: "React", when: "When a video in your niche is already going viral and you can add something to it.", example: "Cut from the viral clip straight to your reaction." },
  { name: "Command", when: "Problem-aware viewers doing something that hurts them.", example: "Stop [COMMON ACTION] right now." },
  { name: "Humor or meme", when: "Cold audiences on short-form platforms; relatability first.", example: "I almost died of embarrassment this weekend..." },
  { name: "Behind-the-scenes authority", when: "When you have real experience to lean on.", example: "After helping 1,000 people with [X], I realized..." },
  { name: "Open curiosity", when: "Cold audiences who don't know about the problem yet.", example: "A fruit that will make you sleep so much better." },
];
