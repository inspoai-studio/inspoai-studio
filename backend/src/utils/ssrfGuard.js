import { URL } from 'url';
import dns from 'dns';
import net from 'net';

/**
 * Checks whether an IP address belongs to a private, loopback, link-local,
 * or cloud metadata range.
 *
 * @param {string} ip - IPv4 or IPv6 address string
 * @returns {boolean} true if IP is private/internal
 */
export function isPrivateIp(ip) {
    if (!ip) return true;

    // Normalize IPv6-mapped IPv4 (e.g. ::ffff:127.0.0.1)
    if (ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }

    // IPv4 checks
    if (net.isIPv4(ip)) {
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
            return true;
        }

        // 0.0.0.0/8 (Current network)
        if (parts[0] === 0) return true;

        // 127.0.0.0/8 (Loopback)
        if (parts[0] === 127) return true;

        // 10.0.0.0/8 (Private network RFC 1918)
        if (parts[0] === 10) return true;

        // 172.16.0.0/12 (Private network RFC 1918: 172.16.0.0 - 172.31.255.255)
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

        // 192.168.0.0/16 (Private network RFC 1918)
        if (parts[0] === 192 && parts[1] === 168) return true;

        // 169.254.0.0/16 (Link-local, AWS/GCP/Azure instance metadata)
        if (parts[0] === 169 && parts[1] === 254) return true;

        // 100.64.0.0/10 (Shared address space / Carrier-grade NAT)
        if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;

        // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (Documentation / TEST-NET)
        if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
        if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
        if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;

        // 224.0.0.0/4 (Multicast)
        if (parts[0] >= 224) return true;

        return false;
    }

    // IPv6 checks
    if (net.isIPv6(ip)) {
        const lower = ip.toLowerCase();
        // ::1 (Loopback) or :: (Unspecified)
        if (lower === '::1' || lower === '::') return true;

        // fe80::/10 (Link-local unicast)
        if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
            return true;
        }

        // fc00::/7 (Unique local address / private)
        if (lower.startsWith('fc') || lower.startsWith('fd')) {
            return true;
        }

        // ff00::/8 (Multicast)
        if (lower.startsWith('ff')) {
            return true;
        }

        return false;
    }

    return true;
}

/**
 * Validates whether a URL is safe to fetch or navigate to by a server.
 * Rejects non-HTTP(S) protocols and resolves DNS to block internal/private IPs.
 *
 * @param {string} inputUrl - URL to validate
 * @returns {Promise<{ isSafe: boolean, error?: string, parsedUrl?: URL }>}
 */
export async function validateSafeUrl(inputUrl) {
    if (!inputUrl || typeof inputUrl !== 'string') {
        return { isSafe: false, error: 'URL must be a non-empty string' };
    }

    let parsed;
    try {
        parsed = new URL(inputUrl);
    } catch {
        return { isSafe: false, error: 'Invalid URL format' };
    }

    // Only allow http: and https: protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { isSafe: false, error: `Disallowed protocol: ${parsed.protocol}. Only http and https are permitted.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Disallow empty hostnames or direct localhost references
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
        return { isSafe: false, error: 'Access to internal or local hostnames is forbidden' };
    }

    // Direct IP validation
    if (net.isIP(hostname)) {
        if (isPrivateIp(hostname)) {
            return { isSafe: false, error: 'Access to private or reserved IP addresses is forbidden' };
        }
        return { isSafe: true, parsedUrl: parsed };
    }

    // Resolve domain to IP addresses via DNS
    try {
        const addresses = await dns.promises.lookup(hostname, { all: true });
        if (!addresses || addresses.length === 0) {
            return { isSafe: false, error: 'Could not resolve hostname' };
        }

        for (const addr of addresses) {
            if (isPrivateIp(addr.address)) {
                return { isSafe: false, error: `Hostname resolves to private/internal IP address (${addr.address})` };
            }
        }

        return { isSafe: true, parsedUrl: parsed };
    } catch (dnsErr) {
        return { isSafe: false, error: `DNS lookup failed: ${dnsErr.message}` };
    }
}
