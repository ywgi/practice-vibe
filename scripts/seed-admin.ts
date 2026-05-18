import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { nanoid } from 'nanoid';

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const dbUrl = process.env.DATABASE_URL;

if (!adminEmail || !adminPassword || !dbUrl) {
	console.error('ADMIN_EMAIL, ADMIN_PASSWORD, and DATABASE_URL must be set');
	process.exit(1);
}

const client = postgres(dbUrl);
const db = drizzle(client, { schema });

const existing = await db
	.select()
	.from(schema.users)
	.where(eq(schema.users.role, 'admin'))
	.limit(1);

if (existing.length > 0) {
	console.log('Admin user already exists, skipping.');
	await client.end();
	process.exit(0);
}

const passwordHash = await hash(adminPassword, {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
});

await db.insert(schema.users).values({
	id: nanoid(),
	email: adminEmail,
	name: 'Admin',
	passwordHash,
	role: 'admin'
});

console.log(`Admin user created: ${adminEmail}`);
await client.end();
process.exit(0);
