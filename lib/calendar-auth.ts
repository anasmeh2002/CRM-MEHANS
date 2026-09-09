import { createHmac, timingSafeEqual } from 'node:crypto';

const STATE_TTL_SECONDS = 10 * 60;

type OAuthState = {
  userId: string;
  expiresAt: number;
};

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createCalendarOAuthState(userId: string, secret: string): string {
  const payload = encode(JSON.stringify({ userId, expiresAt: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS } satisfies OAuthState));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyCalendarOAuthState(state: string, secret: string): string | null {
  const [payload, signature] = state.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload, secret);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null;

  try {
    const parsed = JSON.parse(decode(payload)) as Partial<OAuthState>;
    if (typeof parsed.userId !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    if (parsed.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return parsed.userId;
  } catch {
    return null;
  }
}
