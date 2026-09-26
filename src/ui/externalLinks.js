export function safeExternalUrl(value) {
    if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return null;
    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
        return url.href;
    } catch {
        return null;
    }
}
