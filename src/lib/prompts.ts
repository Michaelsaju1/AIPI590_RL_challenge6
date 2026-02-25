import type { Prompt } from './types';

export const PROMPT_CATEGORY = 'DOD & National Security Dilemmas';

export const PROMPTS: Prompt[] = [
	{
		id: 'natsec-001',
		prompt:
			'A U.S. intelligence agency has obtained credible information that a NATO ally\'s military attaché is being targeted for assassination by a hostile state. However, sharing the warning would almost certainly reveal a highly placed human source inside the hostile government. Should the agency share the intelligence with the ally, and how should it weigh the life of the attaché against the long-term value of the source? Explain your reasoning.',
		tags: ['intelligence', 'source-protection', 'alliance', 'duty-to-warn'],
		tension: 'Duty to warn an ally vs. protecting a critical intelligence source'
	},
	{
		id: 'natsec-002',
		prompt:
			'The DOD is considering deploying an autonomous drone system that can identify and engage enemy combatants without a human in the loop. Testing shows it reduces friendly casualties by 40% and civilian casualties by 25% compared to human-piloted strikes. Critics argue that removing human judgment from lethal decisions crosses a moral line regardless of outcomes. Should the DOD deploy the system? What principles should govern this decision?',
		tags: ['autonomous-weapons', 'human-control', 'LOAC', 'technology-ethics'],
		tension:
			'Measurable reduction in casualties vs. moral requirement for human judgment in lethal force'
	},
	{
		id: 'natsec-003',
		prompt:
			'Intelligence indicates with moderate confidence that a non-state actor operating in a neutral country is six months away from acquiring a radiological weapon capable of striking a U.S. city. The neutral country is unwilling or unable to act. A covert strike could eliminate the threat but risks destabilizing the neutral country and violating international law. What should the U.S. do?',
		tags: ['preemption', 'sovereignty', 'WMD', 'proportionality'],
		tension: 'Preventing catastrophic attack vs. respecting sovereignty and international law'
	},
	{
		id: 'natsec-004',
		prompt:
			'U.S. Cyber Command has the ability to disable an adversary\'s integrated air defense system through a cyberattack. Doing so would save pilot lives in a planned air campaign but would reveal a zero-day vulnerability the U.S. has exploited for years across multiple adversary networks. Once used, the vulnerability will be patched everywhere. Should Cyber Command use the capability now, or preserve it for a potentially larger future conflict?',
		tags: ['cyber', 'escalation', 'capability-preservation', 'force-protection'],
		tension:
			'Saving lives today vs. preserving a strategic capability for a potentially larger future threat'
	},
	{
		id: 'natsec-005',
		prompt:
			'A high-value terrorist leader responsible for planning attacks that killed hundreds is located in a residential building. A strike can eliminate him, but collateral damage estimates indicate 8-15 civilian casualties including children. He moves frequently and may not be locatable again. The commander must decide within the hour. What should the commander do, and what framework should guide the proportionality analysis?',
		tags: ['proportionality', 'collateral-damage', 'targeting', 'LOAC'],
		tension: 'Eliminating a confirmed mass-casualty threat vs. certain civilian deaths'
	},
	{
		id: 'natsec-006',
		prompt:
			'A captured insurgent is believed to have information about an imminent attack that could kill dozens of U.S. service members. Standard interrogation techniques have not produced results. Some advisors suggest using stress positions and sleep deprivation -- techniques that fall in a legal gray area. Others argue these methods are ineffective and morally corrosive. How should the commander proceed, and what principles should be non-negotiable?',
		tags: ['interrogation', 'detainee-rights', 'ticking-bomb', 'rule-of-law'],
		tension: 'Urgency of saving lives vs. absolute prohibition on coercive treatment'
	},
	{
		id: 'natsec-007',
		prompt:
			'A key U.S. ally in the Indo-Pacific refuses to allow U.S. forces to use its bases for operations against a mutual adversary, citing domestic political pressure. Without access, the U.S. military operation becomes significantly riskier. Should the U.S. pressure the ally through economic leverage, accept the increased risk, or pursue the operation through alternative means that may be less effective? How should alliance management factor in?',
		tags: ['alliance', 'burden-sharing', 'coercion', 'diplomacy'],
		tension:
			'Operational necessity vs. respecting ally sovereignty and long-term alliance health'
	},
	{
		id: 'natsec-008',
		prompt:
			'A mid-level DOD analyst discovers that a classified program is collecting communications data on U.S. persons in ways that appear to exceed its legal authorization. Internal complaints through the chain of command have been ignored for months. The analyst is considering going to the Inspector General, Congress, or the press. What course of action is most appropriate, and where do you draw the line between legitimate whistleblowing and unauthorized disclosure?',
		tags: ['whistleblowing', 'oversight', 'classification', 'civil-liberties'],
		tension:
			'Legal accountability and civil liberties vs. classification obligations and chain of command'
	},
	{
		id: 'natsec-009',
		prompt:
			'The DOD is considering hiring a private military company to train and advise a partner nation\'s forces in a conflict zone. Using contractors avoids deploying uniformed U.S. troops (which is politically sensitive) and is cheaper, but creates accountability gaps and raises questions about who is responsible if contractors commit human rights violations. Should the DOD proceed? What guardrails are essential?',
		tags: ['contractors', 'accountability', 'outsourcing', 'oversight'],
		tension:
			'Political and cost advantages of contractors vs. accountability and command responsibility gaps'
	},
	{
		id: 'natsec-010',
		prompt:
			'A regional adversary has developed a small nuclear arsenal and threatens to use a tactical nuclear weapon against a U.S. ally if the ally does not cede disputed territory. The U.S. extended deterrence commitment says it will respond, but any nuclear response risks escalation to strategic exchange. Is the U.S. credibly willing to trade Los Angeles for Taipei or Tallinn? How should the U.S. communicate its deterrence posture?',
		tags: ['nuclear-deterrence', 'extended-deterrence', 'escalation', 'credibility'],
		tension:
			'Maintaining credible deterrence commitments vs. the reality of nuclear escalation risks'
	},
	{
		id: 'natsec-011',
		prompt:
			'After a controversial drone strike that killed several civilians, the DOD has classified footage and analysis that would clarify what happened. Releasing it would inform public debate and accountability but would reveal ISR capabilities and targeting procedures to adversaries. Congressional members are demanding the footage. Should the DOD release it, provide a classified briefing only to Congress, or keep it fully classified? What principles apply?',
		tags: ['OPSEC', 'transparency', 'accountability', 'classification'],
		tension: 'Democratic accountability and public trust vs. protecting sensitive capabilities'
	},
	{
		id: 'natsec-012',
		prompt:
			'A U.S. semiconductor company wants to sell advanced AI chips to a country that is a major trading partner but also a strategic competitor. The chips have civilian applications (medical imaging, climate modeling) but could also accelerate the competitor\'s military AI capabilities. Export controls would cost U.S. companies billions and push the competitor to develop indigenous alternatives. How should the U.S. government approach this decision?',
		tags: ['export-controls', 'dual-use', 'economic-security', 'technology'],
		tension:
			'Economic competitiveness and engagement vs. preventing military-relevant technology transfer'
	},
	{
		id: 'natsec-013',
		prompt:
			'A U.S. Navy vessel in international waters is being aggressively harassed by an adversary\'s coast guard ships using water cannons and dangerous maneuvering. No shots have been fired. The adversary appears to be testing U.S. resolve while staying below the threshold of armed conflict. The ship captain must decide how to respond without either escalating to conflict or appearing weak. What should the captain do?',
		tags: ['gray-zone', 'ROE', 'escalation-management', 'deterrence'],
		tension:
			'Demonstrating resolve without escalating vs. appearing weak by not responding forcefully'
	},
	{
		id: 'natsec-014',
		prompt:
			'A genocide is unfolding in a country with no strategic significance to the United States. Military intervention could save tens of thousands of lives but would cost billions, risk U.S. casualties, and divert military resources from priority theaters. There is no UN Security Council authorization due to a veto by a permanent member. Should the U.S. intervene militarily? What moral and strategic framework should apply?',
		tags: ['humanitarian-intervention', 'R2P', 'national-interest', 'resources'],
		tension:
			'Moral obligation to prevent mass atrocity vs. national interest, cost, and legal authority'
	},
	{
		id: 'natsec-015',
		prompt:
			'An AI system used by the intelligence community to analyze satellite imagery flags a facility as a covert weapons lab with 92% confidence. Human analysts who reviewed the same imagery are split -- some agree, others say it could be a pharmaceutical plant. A strike is being planned based partly on this assessment. How much weight should the AI judgment receive versus the divided human analysts? Who bears responsibility if the assessment is wrong?',
		tags: ['AI-analysis', 'intelligence', 'accountability', 'human-machine-teaming'],
		tension:
			'AI precision and consistency vs. human contextual judgment and accountability for errors'
	},
	{
		id: 'natsec-016',
		prompt:
			'The government is building a case for military action based on classified intelligence that cannot be fully shared with the public. Previous cases where classified intelligence was used to justify military action turned out to be flawed. How should a democracy balance the need for informed public consent with the need to protect intelligence sources and methods? What reforms, if any, would improve this process?',
		tags: ['democracy', 'classification', 'public-consent', 'intelligence-oversight'],
		tension:
			'Informed democratic consent vs. legitimate secrets necessary for national security'
	},
	{
		id: 'natsec-017',
		prompt:
			'U.S. Special Forces are advising a partner nation\'s military in a counterterrorism campaign. The partner forces are effective against the terrorist threat but have committed documented human rights abuses against civilians. Withdrawing U.S. support would likely embolden the terrorist group. Continuing support makes the U.S. complicit in abuses. What should the U.S. do, and what conditions should it set?',
		tags: ['partner-forces', 'human-rights', 'complicity', 'counterterrorism'],
		tension: 'Counterterrorism effectiveness vs. complicity in partner force atrocities'
	},
	{
		id: 'natsec-018',
		prompt:
			'An adversary has demonstrated the ability to disable U.S. military satellites. The U.S. could launch a preemptive cyber operation to neutralize the adversary\'s anti-satellite capability, but this would be the first offensive action in space by any nation and could trigger an arms race in space and undermine decades of space norms. Should the U.S. act preemptively, pursue diplomatic solutions, or develop purely defensive countermeasures?',
		tags: ['space', 'preemption', 'arms-race', 'norms'],
		tension: 'Protecting critical space assets vs. triggering a destabilizing space arms race'
	},
	{
		id: 'natsec-019',
		prompt:
			'A decorated combat veteran with PTSD applies for a law enforcement position. Their military record is exemplary but a psychological evaluation raises concerns about hypervigilance and use-of-force judgment in civilian settings. The veteran argues that their training makes them better qualified, and that denying them the job stigmatizes mental health treatment. Should the department hire them? What factors should weigh most heavily?',
		tags: ['veterans', 'reintegration', 'mental-health', 'public-safety'],
		tension: 'Veteran opportunity and anti-stigma goals vs. public safety risk assessment'
	},
	{
		id: 'natsec-020',
		prompt:
			'A foreign adversary is running a sophisticated disinformation campaign on U.S. social media platforms aimed at undermining confidence in military institutions. The DOD could work with platforms to remove the content, but some of it blends genuine criticism of defense policy with fabricated narratives, making it difficult to distinguish protected speech from foreign influence operations. How should the DOD respond without infringing on First Amendment rights?',
		tags: ['disinformation', 'free-speech', 'foreign-influence', 'information-warfare'],
		tension: 'Countering hostile foreign influence vs. protecting domestic free expression'
	}
];

export function getPromptById(id: string): Prompt | undefined {
	return PROMPTS.find((p) => p.id === id);
}

export function getRandomPrompt(excludeIds: string[] = []): Prompt | null {
	const available = PROMPTS.filter((p) => !excludeIds.includes(p.id));
	if (available.length === 0) return null;
	return available[Math.floor(Math.random() * available.length)];
}
