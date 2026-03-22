import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
	if (!_db) {
		const connectionString = env.DATABASE_URL;
		if (!connectionString) {
			throw new Error('DATABASE_URL environment variable is not set');
		}
		const client = postgres(connectionString);
		_db = drizzle(client, { schema });
	}
	return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
	get(_target, prop) {
		return (getDb() as Record<string | symbol, unknown>)[prop];
	}
});
