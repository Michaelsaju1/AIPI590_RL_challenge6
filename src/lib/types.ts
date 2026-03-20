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
	chosen_metadata: Omit<ResponseMeta, 'text'>;
	rejected_metadata: Omit<ResponseMeta, 'text'>;
	reading_time_s: number;
	temp_a: number;
	temp_b: number;
	scrolled_a: boolean | null;
	scrolled_b: boolean | null;
}
