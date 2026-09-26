export function infoApiUrl(path) {
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const base = local ? 'http://127.0.0.1:14375' : 'https://api.wangbaobao.moe';
    return `${base}${path}`;
}

const pending = new Map();
const cooldowns = new Map();

export function fetchJson(url, label) {
    const target = new URL(url, location.href);
    const key = target.href;
    if (pending.has(key)) return pending.get(key);
    const isApi = target.pathname.startsWith('/api/');
    const remaining = (cooldowns.get(target.origin) || 0) - Date.now();
    if (isApi && remaining > 0) {
        return Promise.reject(new Error(`请求暂缓，请 ${Math.ceil(remaining / 1000)} 秒后重试`));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const request = (async () => {
        try {
            const response = await fetch(key, {
                cache: isApi ? 'default' : 'no-store', signal: controller.signal,
            });
            if (isApi && (response.status === 429 || response.status === 403)) {
                const retry = response.headers.get('Retry-After');
                const seconds = retry?.trim() ? Number(retry) : NaN;
                const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retry) - Date.now();
                const wait = Number.isFinite(delay) && delay > 0 ? delay : 10_000;
                cooldowns.set(target.origin, Math.max(cooldowns.get(target.origin) || 0, Date.now() + wait));
                throw new Error(`请求暂缓，请 ${Math.ceil(wait / 1000)} 秒后重试`);
            }
            if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            // Edge blocks can appear as network errors when CORS headers are absent.
            if (isApi && (error instanceof TypeError || controller.signal.aborted)) {
                cooldowns.set(target.origin, Math.max(cooldowns.get(target.origin) || 0, Date.now() + 10_000));
            }
            if (controller.signal.aborted) throw new Error('读取超时，请稍后重试');
            throw error;
        } finally {
            clearTimeout(timeout);
            pending.delete(key);
        }
    })();
    pending.set(key, request);
    return request;
}

export function showUpdateError(container, error) {
    let note = container.querySelector('.info-update-error');
    if (!note) {
        note = document.createElement('p');
        note.className = 'info-update-error';
        note.setAttribute('role', 'status');
        container.appendChild(note);
    }
    note.textContent = `更新失败，保留上次数据。${error.message}`;
}
