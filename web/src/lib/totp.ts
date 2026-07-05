import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { hash, compare } from 'bcryptjs';

// Allow one 30s step of clock drift in either direction.
authenticator.options = { window: 1 };

const ISSUER = 'ChattingFlow CRM';

/** Generate a fresh base32 TOTP secret for enrollment. */
export function generateTotpSecret(): string {
    return authenticator.generateSecret();
}

/** Build the otpauth:// URI and a data-URL QR image for an authenticator app. */
export async function buildTotpEnrollment(accountLabel: string, secret: string) {
    const otpauthUrl = authenticator.keyuri(accountLabel, ISSUER, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrDataUrl };
}

/** Verify a 6-digit TOTP code against a secret. */
export function verifyTotp(token: string, secret: string): boolean {
    if (!token || !secret) return false;
    try {
        return authenticator.verify({ token: token.replace(/\s/g, ''), secret });
    } catch {
        return false;
    }
}

/** Generate N human-friendly backup codes (plaintext, shown once) + their bcrypt hashes (stored). */
export async function generateBackupCodes(count = 10): Promise<{ plain: string[]; hashed: string[] }> {
    const plain: string[] = [];
    for (let i = 0; i < count; i++) {
        const raw = crypto.randomBytes(5).toString('hex'); // 10 hex chars
        plain.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
    }
    const hashed = await Promise.all(plain.map((c) => hash(c, 10)));
    return { plain, hashed };
}

/**
 * Check a submitted backup code against the stored hashed list.
 * Returns the remaining hashes (with the used one removed) if it matched, else null.
 */
export async function consumeBackupCode(
    submitted: string,
    hashedCodes: string[]
): Promise<string[] | null> {
    const normalized = submitted.replace(/\s/g, '').toLowerCase();
    for (let i = 0; i < hashedCodes.length; i++) {
        if (await compare(normalized, hashedCodes[i])) {
            return hashedCodes.filter((_, idx) => idx !== i);
        }
    }
    return null;
}
