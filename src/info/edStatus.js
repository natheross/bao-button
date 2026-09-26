import { fetchJson } from './api.js';

const ED_URL = new URL('../../generated/ed.json', import.meta.url);
let entries = null;
let loading = null;

function keyword(value) {
    return String(value || '').trim().toLocaleLowerCase();
}

export function filterEdEntries(items, { date = '', search = '' }) {
    const query = keyword(search);
    const dateQuery = String(date).replace(/\D/g, '');
    return items.filter(entry =>
        (!dateQuery || String(entry.date || '').replace(/\D/g, '').includes(dateQuery)) &&
        (!query || keyword(entry.song).includes(query) || keyword(entry.author).includes(query))
    );
}

function currentFilters() {
    return {
        date: document.getElementById('edDateFilter')?.value || '',
        search: document.getElementById('edKeywordFilter')?.value || '',
    };
}

export function updateEdResults() {
    const container = document.getElementById('edContent');
    if (!container || !entries) return;
    const matches = filterEdEntries(entries, currentFilters());
    if (!matches.length) {
        container.textContent = entries.length ? '没有符合条件的 ED 记录' : '暂无 ED 记录';
        return;
    }
    const cards = matches.map(entry => {
        const card = document.createElement('article');
        card.className = 'info-card ed-card';
        const title = document.createElement('h2');
        title.textContent = String(entry.song || '歌名暂无');
        title.title = title.textContent;
        const detail = document.createElement('p');
        detail.textContent = `${entry.date || '日期未录入'} · 歌手：${entry.author || '未录入'}`;
        detail.title = detail.textContent;
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'ed-copy-button';
        copy.setAttribute('aria-label', `复制歌名：${title.textContent}`);
        copy.title = `${title.textContent}\n${detail.textContent}\n点击复制歌名`;
        detail.setAttribute('aria-live', 'polite');
        const originalDetail = detail.textContent;
        let feedbackTimer;
        copy.addEventListener('click', async () => {
            copy.disabled = true;
            clearTimeout(feedbackTimer);
            try {
                await navigator.clipboard.writeText(title.textContent);
                detail.textContent = '已复制歌名';
            } catch {
                detail.textContent = '复制失败，请检查浏览器剪贴板权限';
            } finally {
                copy.disabled = false;
                feedbackTimer = setTimeout(() => { detail.textContent = originalDetail; }, 500);
            }
        });
        card.append(title, detail, copy);
        return card;
    });
    container.replaceChildren(...cards);
    container.scrollTop = 0;
}

export async function renderEdStatus({ force = false } = {}) {
    const container = document.getElementById('edContent');
    if (!container) return;
    if (force && loading) {
        try { await loading; } catch { /* The manual refresh will retry. */ }
    }
    if (force) entries = null;
    if (entries) {
        updateEdResults();
        return true;
    }
    container.textContent = '正在读取 ED...';
    if (!loading) {
        loading = fetchJson(ED_URL, 'ED').then(data => {
            if (!Array.isArray(data)) throw new Error('ED 数据格式错误');
            entries = data.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
            const dateOptions = document.getElementById('edDateOptions');
            if (dateOptions) {
                dateOptions.replaceChildren();
                const dates = [...new Set(entries.map(entry => entry.date).filter(Boolean))].sort().reverse();
                for (const date of ['', ...dates]) {
                    const option = document.createElement('button');
                    option.type = 'button';
                    option.textContent = date || '取消筛选';
                    option.addEventListener('click', () => {
                        const input = document.getElementById('edDateFilter');
                        input.value = date;
                        document.getElementById('edDateMenu').open = false;
                        updateEdResults();
                        input.focus();
                    });
                    dateOptions.appendChild(option);
                }
            }
        }).finally(() => { loading = null; });
    }
    try {
        await loading;
        updateEdResults();
        return true;
    } catch (error) {
        console.error(error);
        container.textContent = 'ED 记录暂时无法读取';
        return false;
    }
}
