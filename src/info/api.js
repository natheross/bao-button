const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const base = local ? 'http://127.0.0.1:14375' : 'https://api.wangbaobao.moe';

export function infoApiUrl(path) {
    return `${base}${path}`;
}
