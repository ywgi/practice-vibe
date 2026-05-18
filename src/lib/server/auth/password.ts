import { hash, verify } from '@node-rs/argon2';

export async function hashPassword(plain: string): Promise<string> {
	return hash(plain, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	});
}

export async function verifyPassword(plain: string, hashedPassword: string): Promise<boolean> {
	return verify(hashedPassword, plain);
}
