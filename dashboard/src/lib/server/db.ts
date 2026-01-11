import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';

const DB_PATH = join(homedir(), '.config', 'opencode', 'token-usage.db');

export function getDb() {
	return new Database(DB_PATH, { readonly: true });
}

export interface Request {
	id: number;
	message_id: string;
	session_id: string;
	provider_id: string;
	model_id: string;
	agent: string;
	tokens_input: number;
	tokens_output: number;
	tokens_reasoning: number;
	tokens_cache_read: number;
	tokens_cache_write: number;
	cost_usd: number;
	duration_ms: number | null;
	finish_reason: string | null;
	working_dir: string | null;
	created_at: string;
	completed_at: string | null;
}

export interface Session {
	session_id: string;
	project_dir: string | null;
	title: string | null;
	first_request_at: string | null;
	last_request_at: string | null;
	total_requests: number;
	total_cost_usd: number;
	total_tokens_input: number;
	total_tokens_output: number;
}

export interface DailySummary {
	id: number;
	date: string;
	provider_id: string;
	model_id: string;
	request_count: number;
	tokens_input: number;
	tokens_output: number;
	tokens_reasoning: number;
	tokens_cache_read: number;
	tokens_cache_write: number;
	cost_usd: number;
}
