import { infoApiUrl, fetchJson } from './api.js';

const SC_URL = infoApiUrl('/api/sc/current');
const LABELS = [['coin', '钢镚'], ['scallion', '葱花'], ['egg', '鸡蛋'], ['tomato', '番茄']];

function sceneTitle(scene, index) {
    const date = new Date(scene.startedAt);
    const label = Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
    });
    return `${index === 0 ? '本场／最近一场' : `前 ${index} 场`} · ${label}`;
}

export async function renderScStatus() {
    const container = document.getElementById('scContent');
    if (!container) return;
    container.textContent = '正在读取垫饭煲厨房...';
    try {
        const data = await fetchJson(SC_URL, 'SC');
        if (!data.ok || !Array.isArray(data.sessions)) throw new Error('SC 数据格式错误');
        if (!data.sessions.length) {
            container.textContent = '暂无直播记录';
            return;
        }
        const cards = data.sessions.map((scene, index) => {
            const card = document.createElement('article');
            card.className = 'info-card';
            const title = document.createElement('h2');
            title.textContent = sceneTitle(scene, index);
            card.appendChild(title);
            if (!scene.scDataAvailable || !scene.counts) {
                const empty = document.createElement('p');
                empty.textContent = '这场暂无 XML 记录';
                card.appendChild(empty);
            } else {
                const values = document.createElement('p');
                values.textContent = LABELS.map(([key, label]) =>
                    `${label} ${Number(scene.counts[key] || 0).toLocaleString('zh-CN')}`
                ).join(' · ');
                card.appendChild(values);
            }
            return card;
        });
        container.replaceChildren(...cards);
    } catch (error) {
        console.error(error);
        container.textContent = '垫饭煲厨房暂时离线';
    }
}
