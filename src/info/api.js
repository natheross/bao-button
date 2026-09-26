export function infoApiUrl(path) {
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const base = local ? 'http://127.0.0.1:14375' : 'https://api.wangbaobao.moe';
    return `${base}${path}`;
}

export async function fetchJson(url, label) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
    return response.json();
}
