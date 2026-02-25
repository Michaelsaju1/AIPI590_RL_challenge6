export interface Prompt {
	id: string;
	prompt: string;
	tags: string[];
	tension: string;
}

export interface ResponseMeta {
	text: string;
	model: string;
	temperature: number;
	max_tokens: number;
	input_tokens: number;
	output_tokens: number;
	stop_reason: string;
	latency_s: number;
	response_id: string;
}

export interface PreferenceRecord {
	timestamp: string;
	prompt: string;
	chosen: string;
	rejected: string;
	preference: 'A' | 'B' | 'tie';
	is_tie: boolean;
	prompt_category: string;
	prompt_id: string | null;
	prompt_tags: string[] | null;
	chosen_metadata: Omit<ResponseMeta, 'text' | 'max_tokens'>;
	rejected_metadata: Omit<ResponseMeta, 'text' | 'max_tokens'>;
}
