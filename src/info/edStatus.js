import { fetchJson } from './api.js';

const ED_URL = new URL('../../public/data/ed.json', import.meta.url);
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
        detail.textContent = `${entry.date || '日期暂无'} · 歌手：${entry.author || '暂无'}`;
        detail.title = detail.textContent;
        card.append(title, detail);
        return card;
    });
    container.replaceChildren(...cards);
    container.scrollTop = 0;
}

export async function renderEdStatus() {
    const container = document.getElementById('edContent');
    if (!container) return;
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
                const dates = [...new Set(entries.map(entry => entry.date).filter(Boolean))].sort().reverse();
                for (const date of dates) {
                    const option = document.createElement('option');
                    option.value = date;
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
