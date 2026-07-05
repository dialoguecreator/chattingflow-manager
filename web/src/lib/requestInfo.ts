// Extracts the client IP and device string from a request's headers.
// NextAuth's Credentials `authorize(credentials, req)` provides a plain
// object with a `headers` map, which is what we parse here.

type HeaderBag = Record<string, string | string[] | undefined> | Headers | undefined;

function headerValue(headers: HeaderBag, name: string): string | undefined {
    if (!headers) return undefined;
    if (typeof (headers as Headers).get === 'function') {
        return (headers as Headers).get(name) ?? undefined;
    }
    const bag = headers as Record<string, string | string[] | undefined>;
    const v = bag[name] ?? bag[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
}

export function getClientIp(headers: HeaderBag): string {
    // Behind nginx / a proxy, the real client IP is in these forwarded headers.
    // x-forwarded-for may be a comma-separated list; the first entry is the client.
    const forwarded = headerValue(headers, 'x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return (
        headerValue(headers, 'x-real-ip') ||
        headerValue(headers, 'cf-connecting-ip') ||
        'unknown'
    );
}

export function getUserAgent(headers: HeaderBag): string {
    return headerValue(headers, 'user-agent') || 'unknown';
}
