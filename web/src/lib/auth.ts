import type { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import prisma from '@/lib/prisma';
import { getClientIp, getUserAgent } from '@/lib/requestInfo';
import { verifyTotp, consumeBackupCode } from '@/lib/totp';

// Signals thrown from authorize() so the login page can react. NextAuth v4
// surfaces the thrown Error message as `result.error` when redirect: false.
export const TWO_FACTOR_REQUIRED = '2FA_REQUIRED';
export const INVALID_2FA = 'INVALID_2FA';
export const ACCOUNT_FIRED = 'ACCOUNT_FIRED';

async function recordAttempt(data: {
    userId: number | null;
    email: string;
    success: boolean;
    reason: string;
    ip: string;
    userAgent: string;
}) {
    try {
        await prisma.loginAudit.create({
            data: {
                userId: data.userId,
                email: data.email,
                success: data.success,
                reason: data.reason,
                ipAddress: data.ip,
                userAgent: data.userAgent,
            },
        });
    } catch {
        // Never let audit logging break the login flow.
    }
}

export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
                token: { label: '2FA Code', type: 'text' },
            },
            async authorize(credentials, req) {
                const ip = getClientIp(req?.headers as any);
                const userAgent = getUserAgent(req?.headers as any);
                const email = credentials?.email ?? '';

                if (!credentials?.email || !credentials?.password) return null;

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });

                if (!user) {
                    await recordAttempt({ userId: null, email, success: false, reason: 'NO_SUCH_USER', ip, userAgent });
                    return null;
                }

                // Not-yet-activated invite accounts cannot log in.
                if (user.inviteToken) {
                    await recordAttempt({ userId: user.id, email, success: false, reason: 'NOT_ACTIVATED', ip, userAgent });
                    return null;
                }

                // Fired accounts are locked out (e.g. a former partner/employee).
                // Throw a signal so the login page can show a custom message.
                if (user.status === 'FIRED') {
                    await recordAttempt({ userId: user.id, email, success: false, reason: 'FIRED', ip, userAgent });
                    throw new Error(ACCOUNT_FIRED);
                }

                const valid = await compare(credentials.password, user.password);
                if (!valid) {
                    await recordAttempt({ userId: user.id, email, success: false, reason: 'BAD_PASSWORD', ip, userAgent });
                    return null;
                }

                // Password is correct — enforce 2FA if this account has it enabled.
                if (user.twoFactorEnabled && user.twoFactorSecret) {
                    const submitted = (credentials.token ?? '').trim();

                    if (!submitted) {
                        // Password right, but we need the second factor. Not logged as a
                        // failure — it's just a prompt for the code.
                        throw new Error(TWO_FACTOR_REQUIRED);
                    }

                    let accepted = verifyTotp(submitted, user.twoFactorSecret);

                    // If not a valid TOTP, try it as a one-time backup code.
                    if (!accepted) {
                        const backupCodes: string[] = JSON.parse(user.twoFactorBackupCodes || '[]');
                        const remaining = await consumeBackupCode(submitted, backupCodes);
                        if (remaining) {
                            accepted = true;
                            await prisma.user.update({
                                where: { id: user.id },
                                data: { twoFactorBackupCodes: JSON.stringify(remaining) },
                            });
                        }
                    }

                    if (!accepted) {
                        await recordAttempt({ userId: user.id, email, success: false, reason: 'BAD_2FA', ip, userAgent });
                        throw new Error(INVALID_2FA);
                    }
                }

                await recordAttempt({ userId: user.id, email, success: true, reason: 'OK', ip, userAgent });

                return {
                    id: String(user.id),
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                    role: user.role,
                };
            },
        }),
    ],
    session: { strategy: 'jwt' },
    callbacks: {
        async jwt({ token, user }: any) {
            if (user) {
                token.userId = parseInt(user.id);
            }
            // Always refresh role + 2FA status from DB so changes take effect immediately
            if (token.userId) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.userId },
                    select: { role: true, twoFactorEnabled: true },
                });
                if (dbUser) {
                    token.role = dbUser.role;
                    token.twoFactorEnabled = dbUser.twoFactorEnabled;
                }
            }
            return token;
        },
        async session({ session, token }: any) {
            if (session.user) {
                session.user.role = token.role;
                session.user.id = token.userId;
                session.user.twoFactorEnabled = token.twoFactorEnabled;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
    secret: process.env.NEXTAUTH_SECRET,
};
