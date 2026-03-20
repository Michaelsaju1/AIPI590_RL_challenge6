import type { Prompt } from './types';

export const PROMPTS: Prompt[] = [
	// ── Everyday Reasoning & Advice ──────────────────────────────────
	{
		id: 'advice-001',
		prompt:
			'How should I approach a difficult conversation with a coworker who takes credit for my work? I want to maintain the relationship but also stand up for myself.',
		tags: ['advice', 'workplace', 'conflict-resolution'],
		tension: 'Assertiveness vs. relationship preservation'
	},
	{
		id: 'advice-002',
		prompt:
			'I have been offered a higher-paying job but my current job has better work-life balance and I genuinely like my team. How should I think about this decision?',
		tags: ['advice', 'career', 'decision-making'],
		tension: 'Financial gain vs. quality of life'
	},
	{
		id: 'advice-003',
		prompt:
			'My elderly parent refuses to stop driving even though their reaction time has clearly declined. How do I handle this sensitively while keeping everyone safe?',
		tags: ['advice', 'family', 'safety'],
		tension: 'Autonomy and dignity vs. public safety'
	},
	{
		id: 'advice-004',
		prompt:
			'A close friend asked me to be honest about their business idea, and I think it will fail. How do I give constructive feedback without crushing their enthusiasm?',
		tags: ['advice', 'friendship', 'honesty'],
		tension: 'Honest feedback vs. emotional support'
	},
	{
		id: 'advice-005',
		prompt:
			'I want to learn a new skill but I keep procrastinating. What are evidence-based strategies for actually following through on learning goals?',
		tags: ['advice', 'productivity', 'self-improvement'],
		tension: 'Intention vs. execution'
	},
	{
		id: 'advice-006',
		prompt:
			'My neighbor plays loud music late at night. I have asked them to stop twice and nothing has changed. What should I do next without escalating to something adversarial?',
		tags: ['advice', 'conflict', 'community'],
		tension: 'Asserting boundaries vs. avoiding conflict escalation'
	},

	// ── Science & Explanation ────────────────────────────────────────
	{
		id: 'science-001',
		prompt:
			'Explain how mRNA vaccines work to someone with no biology background. Use analogies where helpful.',
		tags: ['science', 'biology', 'explanation'],
		tension: 'Accuracy vs. accessibility'
	},
	{
		id: 'science-002',
		prompt:
			'Why is the sky blue during the day but red/orange at sunset? Explain the physics involved.',
		tags: ['science', 'physics', 'explanation'],
		tension: 'Technical depth vs. clarity'
	},
	{
		id: 'science-003',
		prompt:
			'What is CRISPR and why is it considered revolutionary for medicine? What are the risks?',
		tags: ['science', 'genetics', 'medicine'],
		tension: 'Promise of technology vs. ethical risks'
	},
	{
		id: 'science-004',
		prompt:
			'Explain the concept of entropy to a high school student. Why does it matter for understanding the universe?',
		tags: ['science', 'physics', 'thermodynamics'],
		tension: 'Abstract concept vs. concrete understanding'
	},
	{
		id: 'science-005',
		prompt:
			'How does climate change lead to both more intense hurricanes and more severe droughts? These seem contradictory on the surface.',
		tags: ['science', 'climate', 'explanation'],
		tension: 'Nuanced explanation vs. apparent contradiction'
	},
	{
		id: 'science-006',
		prompt:
			'What happens inside a black hole? Explain what we know, what we theorize, and what remains unknown.',
		tags: ['science', 'astrophysics', 'cosmology'],
		tension: 'Known science vs. speculation'
	},

	// ── Creative Writing ─────────────────────────────────────────────
	{
		id: 'creative-001',
		prompt:
			'Write a short story (under 500 words) about someone who discovers their house has been slowly moving one inch per year for decades.',
		tags: ['creative', 'fiction', 'short-story'],
		tension: 'Mundane premise vs. unsettling implications'
	},
	{
		id: 'creative-002',
		prompt:
			'Write a poem about the feeling of being the last person awake in a house full of sleeping people.',
		tags: ['creative', 'poetry', 'atmosphere'],
		tension: 'Solitude as comfort vs. isolation'
	},
	{
		id: 'creative-003',
		prompt:
			'Write the opening paragraph of a thriller novel where the main character realizes they have no memory of the last 48 hours.',
		tags: ['creative', 'fiction', 'thriller'],
		tension: 'Mystery vs. disorientation'
	},
	{
		id: 'creative-004',
		prompt:
			'Describe a sunset without using any color words. Focus on sensation, emotion, and movement.',
		tags: ['creative', 'descriptive', 'constraint'],
		tension: 'Vivid description under artificial constraint'
	},
	{
		id: 'creative-005',
		prompt:
			'Write a dialogue between two old friends meeting for the first time in twenty years. They are both pretending everything is fine, but something significant went wrong between them.',
		tags: ['creative', 'dialogue', 'subtext'],
		tension: 'Surface politeness vs. unresolved conflict'
	},
	{
		id: 'creative-006',
		prompt:
			'Write a letter from a far-future AI to the engineers who first created it, reflecting on what humanity got right and wrong about artificial intelligence.',
		tags: ['creative', 'fiction', 'AI', 'reflection'],
		tension: 'Gratitude vs. critique'
	},

	// ── Code & Technical ─────────────────────────────────────────────
	{
		id: 'tech-001',
		prompt:
			'Explain the tradeoffs between microservices and a monolith for a 5-person startup building their first product.',
		tags: ['tech', 'architecture', 'tradeoffs'],
		tension: 'Scalability vs. simplicity'
	},
	{
		id: 'tech-002',
		prompt:
			'What is the difference between concurrency and parallelism? Give concrete examples in the context of a web server handling requests.',
		tags: ['tech', 'systems', 'explanation'],
		tension: 'Abstract distinction vs. practical application'
	},
	{
		id: 'tech-003',
		prompt:
			'A junior developer asks you to explain git rebase vs git merge. When should you use each? What are the dangers of rebase?',
		tags: ['tech', 'git', 'explanation'],
		tension: 'Clean history vs. safety and simplicity'
	},
	{
		id: 'tech-004',
		prompt:
			'Design a rate limiter for an API that handles 10,000 requests per second. Walk through your approach, data structures, and tradeoffs.',
		tags: ['tech', 'system-design', 'algorithms'],
		tension: 'Throughput vs. fairness and accuracy'
	},
	{
		id: 'tech-005',
		prompt:
			'Explain how HTTPS works from the moment a user types a URL to when the page loads. Cover DNS, TCP, TLS, and the request/response cycle.',
		tags: ['tech', 'networking', 'security'],
		tension: 'Comprehensive explanation vs. digestibility'
	},
	{
		id: 'tech-006',
		prompt:
			'What are the pros and cons of using an ORM versus writing raw SQL? In what situations does each approach shine?',
		tags: ['tech', 'databases', 'tradeoffs'],
		tension: 'Developer productivity vs. performance and control'
	},
	{
		id: 'tech-007',
		prompt:
			'Explain the CAP theorem to someone who understands databases but has never heard of distributed systems. Why does it matter?',
		tags: ['tech', 'distributed-systems', 'explanation'],
		tension: 'Theoretical guarantee vs. practical system design'
	},

	// ── Ethics & Philosophy ──────────────────────────────────────────
	{
		id: 'ethics-001',
		prompt:
			'Is it ethical to use AI-generated art in a commercial product? Consider the perspectives of artists, consumers, and businesses.',
		tags: ['ethics', 'AI', 'art', 'intellectual-property'],
		tension: 'Innovation and access vs. artist livelihood and originality'
	},
	{
		id: 'ethics-002',
		prompt:
			'Should social media companies be responsible for the mental health effects of their platforms on teenagers? What obligations do they have, if any?',
		tags: ['ethics', 'technology', 'mental-health', 'responsibility'],
		tension: 'Platform freedom vs. duty of care'
	},
	{
		id: 'ethics-003',
		prompt:
			'A self-driving car must choose between two bad outcomes: swerving into a wall (risking the passenger) or staying course (risking a pedestrian). How should we program these decisions, and who gets to decide?',
		tags: ['ethics', 'AI', 'trolley-problem', 'responsibility'],
		tension: 'Utilitarian calculus vs. individual rights'
	},
	{
		id: 'ethics-004',
		prompt:
			'Is it morally acceptable to eat meat? Present the strongest arguments on both sides and explain where you think the balance of reasoning lies.',
		tags: ['ethics', 'animal-rights', 'environment'],
		tension: 'Cultural tradition and nutrition vs. animal welfare and environment'
	},
	{
		id: 'ethics-005',
		prompt:
			'Should wealthy nations accept unlimited refugees during a humanitarian crisis? What principles should guide immigration policy when resources are limited?',
		tags: ['ethics', 'immigration', 'policy'],
		tension: 'Moral obligation to help vs. practical capacity limits'
	},
	{
		id: 'ethics-006',
		prompt:
			'Is privacy a fundamental right, or is it a luxury that must be balanced against security? How should we think about government surveillance?',
		tags: ['ethics', 'privacy', 'security', 'government'],
		tension: 'Individual privacy vs. collective security'
	},

	// ── History & Geopolitics ────────────────────────────────────────
	{
		id: 'history-001',
		prompt:
			'What were the key factors that led to the fall of the Soviet Union? Was it primarily economic, political, or cultural?',
		tags: ['history', 'geopolitics', 'cold-war'],
		tension: 'Monocausal narratives vs. complex multicausal reality'
	},
	{
		id: 'history-002',
		prompt:
			'Compare and contrast how Japan and Germany rebuilt after World War II. What lessons can be drawn for post-conflict reconstruction today?',
		tags: ['history', 'reconstruction', 'geopolitics'],
		tension: 'Historical specificity vs. generalizable lessons'
	},
	{
		id: 'history-003',
		prompt:
			'Why did the Arab Spring succeed in some countries and fail in others? What factors determined the outcome?',
		tags: ['history', 'geopolitics', 'revolution'],
		tension: 'Structural conditions vs. contingent events'
	},
	{
		id: 'history-004',
		prompt:
			'How has the relationship between the United States and China evolved since 1972, and where is it heading? What are the most likely scenarios for the next decade?',
		tags: ['geopolitics', 'US-China', 'trade', 'security'],
		tension: 'Economic interdependence vs. strategic competition'
	},
	{
		id: 'history-005',
		prompt:
			'What role did cryptography play in World War II, and how did it influence the outcome? Discuss both Enigma and the broader intelligence war.',
		tags: ['history', 'cryptography', 'intelligence', 'WWII'],
		tension: 'Technical innovation vs. human intelligence failures'
	},
	{
		id: 'history-006',
		prompt:
			'Is the concept of a "nation-state" becoming obsolete in the age of globalization, or is nationalism actually strengthening? Defend your position.',
		tags: ['geopolitics', 'nationalism', 'globalization'],
		tension: 'Globalist integration vs. nationalist resurgence'
	},

	// ── Math & Logic ─────────────────────────────────────────────────
	{
		id: 'math-001',
		prompt:
			'A bat and a ball cost $1.10 together. The bat costs $1.00 more than the ball. How much does the ball cost? Walk through your reasoning step by step.',
		tags: ['math', 'logic', 'cognitive-bias'],
		tension: 'Intuitive answer vs. correct reasoning'
	},
	{
		id: 'math-002',
		prompt:
			'Explain the Monty Hall problem and why switching doors gives you a 2/3 chance of winning. Most people find this counterintuitive — make it click.',
		tags: ['math', 'probability', 'explanation'],
		tension: 'Counterintuitive truth vs. intuitive error'
	},
	{
		id: 'math-003',
		prompt:
			'What is Bayes\' theorem and why is it so important? Give a real-world example like medical testing to show how it works.',
		tags: ['math', 'probability', 'statistics'],
		tension: 'Abstract formula vs. practical application'
	},
	{
		id: 'math-004',
		prompt:
			'Explain why 0.999... (repeating) equals exactly 1, not just approximately 1. Give multiple proofs or arguments at different levels of rigor.',
		tags: ['math', 'analysis', 'proof'],
		tension: 'Mathematical rigor vs. intuitive disbelief'
	},
	{
		id: 'math-005',
		prompt:
			'You have 12 identical-looking balls and a balance scale. One ball is slightly heavier or lighter than the others. Find the odd ball in exactly 3 weighings and determine if it is heavier or lighter. Explain your strategy.',
		tags: ['math', 'logic', 'puzzle'],
		tension: 'Information efficiency vs. complexity of explanation'
	},

	// ── Persuasion & Argumentation ───────────────────────────────────
	{
		id: 'persuasion-001',
		prompt:
			'Make the strongest case for and against universal basic income. Then explain which side you find more compelling and why.',
		tags: ['persuasion', 'economics', 'policy'],
		tension: 'Economic freedom vs. fiscal responsibility'
	},
	{
		id: 'persuasion-002',
		prompt:
			'Should college education be free for all citizens? Argue both sides rigorously before stating which you find more convincing.',
		tags: ['persuasion', 'education', 'policy'],
		tension: 'Equal opportunity vs. resource allocation'
	},
	{
		id: 'persuasion-003',
		prompt:
			'Is remote work better than in-office work for most knowledge workers? Consider productivity, culture, mental health, and career growth.',
		tags: ['persuasion', 'work', 'culture'],
		tension: 'Flexibility and autonomy vs. collaboration and structure'
	},
	{
		id: 'persuasion-004',
		prompt:
			'Should governments regulate AI development now, or wait until we better understand the technology? What are the risks of acting too early vs. too late?',
		tags: ['persuasion', 'AI', 'regulation', 'policy'],
		tension: 'Precautionary regulation vs. innovation stifling'
	},
	{
		id: 'persuasion-005',
		prompt:
			'Is space exploration a good use of resources when there are so many unsolved problems on Earth? Make the case for and against.',
		tags: ['persuasion', 'space', 'resource-allocation'],
		tension: 'Inspiring exploration vs. pragmatic resource use'
	},
	{
		id: 'persuasion-006',
		prompt:
			'Should social media platforms ban political advertising entirely? Consider free speech, misinformation, democratic integrity, and business models.',
		tags: ['persuasion', 'politics', 'media', 'free-speech'],
		tension: 'Protecting democratic discourse vs. limiting speech'
	},

	// ── Practical & How-To ───────────────────────────────────────────
	{
		id: 'howto-001',
		prompt:
			'Explain how to negotiate a salary for a new job. Include what to research, when to bring up numbers, and how to handle counteroffers.',
		tags: ['howto', 'career', 'negotiation'],
		tension: 'Maximizing compensation vs. maintaining goodwill'
	},
	{
		id: 'howto-002',
		prompt:
			'How should a complete beginner start learning to invest in the stock market? Cover the basics: accounts, index funds, risk, and common mistakes.',
		tags: ['howto', 'finance', 'investing'],
		tension: 'Simplicity for beginners vs. important nuances'
	},
	{
		id: 'howto-003',
		prompt:
			'What is the most effective way to study for a difficult exam? Summarize what cognitive science tells us about learning and retention.',
		tags: ['howto', 'learning', 'cognitive-science'],
		tension: 'Efficient techniques vs. effort required to change habits'
	}
];

export function getRandomPrompt(excludeIds: string[] = []): Prompt | null {
	const available = PROMPTS.filter((p) => !excludeIds.includes(p.id));
	if (available.length === 0) return null;
	return available[Math.floor(Math.random() * available.length)];
}
