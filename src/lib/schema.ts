import { pgTable, serial, text, real, boolean, timestamp, index, jsonb } from 'drizzle-orm/pg-core';

export const preferences = pgTable('preferences', {
	id: serial('id').primaryKey(),
	timestamp: text('timestamp').notNull(),
	prompt: text('prompt').notNull(),
	chosen: text('chosen').notNull(),
	rejected: text('rejected').notNull(),
	preference: text('preference').notNull(),
	is_tie: boolean('is_tie').notNull().default(false),
	prompt_category: text('prompt_category'),
	prompt_id: text('prompt_id'),
	prompt_tags: jsonb('prompt_tags'),
	chosen_metadata: jsonb('chosen_metadata'),
	rejected_metadata: jsonb('rejected_metadata'),
	reading_time_s: real('reading_time_s'),
	user_ip: text('user_ip'),
	temp_a: real('temp_a'),
	temp_b: real('temp_b'),
	scrolled_a: boolean('scrolled_a'),
	scrolled_b: boolean('scrolled_b'),
	created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_preferences_prompt_id').on(table.prompt_id),
	index('idx_preferences_category').on(table.prompt_category),
]);
