import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase();
}

export async function hashInviteCode(code: string): Promise<string> {
  const normalized = code.trim().toUpperCase();
  return bcrypt.hash(normalized, SALT_ROUNDS);
}

export async function verifyInviteCode(code: string, hash: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  return bcrypt.compare(normalized, hash);
}

export function sanitizeText(input: string, maxLength = 200): string {
  return input.trim().slice(0, maxLength).replace(/[<>]/g, '');
}
