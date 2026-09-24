import { infoApiUrl, fetchJson } from './api.js';

const CURRENT_URL = infoApiUrl('/api/current');

function formatTimeAgo(value) {
    if (!value) return '暂无';
    const elapsed = Math.max(0, Date.now() - Date.parse(value));
    if (!Number.isFinite(elapsed)) return '暂无';
    const minutes = Math.floor(elapsed / 60_000);
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor(minutes / 60) % 24;
    return `${days}天${hours}小时${minutes % 60}分钟`;
}

function formatCount(value) {
    return Number.isFinite(value) ? value.toLocaleString('zh-CN') : '暂无';
}

function formatCountWithUnit(value, unit) {
    return Number.isFinite(value) ? `${formatCount(value)}${unit}` : '暂无';
}

function formatDateTime(value) {
    if (!value) return '暂无';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '暂无' : date.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
}

function createStatusItem(key, label, value) {
    const item = document.createElement('div');
    item.className = `current-status-item current-status-item--${key}`;
    const name = document.createElement('span');
    name.className = 'current-status-label';
    name.textContent = label;
    const content = document.createElement('strong');
    content.className = 'current-status-value';
    content.textContent = value;
    item.append(name, content);
    return item;
}

export async function renderCurrentStatus() {
    const container = document.getElementById('currentStatusContent');
    if (!container) return;
    container.classList.add('current-status-grid--loading');
    container.textContent = '正在读取数据...';
    try {
        const data = await fetchJson(CURRENT_URL, '目前数据');
        if (!data.ok) throw new Error(data.error || '目前数据暂不可用');

        const live = data.live || {};
        const liveText = {
            live: '正在直播', offline: '未开播', round: '轮播', unknown: '状态未知'
        }[live.status] || '状态未知';
        const lastSeenText = live.status === 'live'
            ? '正在直播'
            : formatTimeAgo(data.lastSeenAt);

        container.classList.remove('current-status-grid--loading', 'current-status-grid--offline');
        container.replaceChildren(
            createStatusItem('followers', '粉丝量', formatCount(data.followers)),
            createStatusItem('guards', '大航海总数', formatCount(data.guards)),
            createStatusItem('status', '当前', liveText),
            createStatusItem('streams', '本月直播次数', formatCountWithUnit(data.streamsThisMonth, '次')),
            createStatusItem('last-started', '上次开播时间', formatDateTime(live.lastStartedAt)),
            createStatusItem('last-seen', '距离上次出现', lastSeenText),
            createStatusItem('uploads', '本月已投稿', formatCountWithUnit(data.uploadsThisMonth, '个')),
            createStatusItem('golden', '本月累计黄金舰长', data.goldenScThisMonth == null
                ? '10 月 1 日开始统计' : formatCountWithUnit(data.goldenScThisMonth, '个'))
        );
        const updated = document.createElement('p');
        updated.className = 'current-status-updated';
        updated.textContent = `读取时间（北京时间）：${new Date(data.updatedAt).toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
        })}`;
        container.appendChild(updated);
    } catch (error) {
        console.error(error);
        container.classList.remove('current-status-grid--loading');
        container.classList.add('current-status-grid--offline');
        container.replaceChildren(createStatusItem('offline', '目前数据', '暂时离线'));
    }
}
