function formatTimeAgo(timeString) {
    if (!timeString) return '暂无';

    const time = new Date(timeString).getTime();
    const diff = Date.now() - time;

    if (diff < 0) return '刚刚';

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) {
        return '刚刚';
    }

    if (diff < hour) {
        return `${Math.floor(diff / minute)} 分钟前`;
    }

    if (diff < day) {
        return `${Math.floor(diff / hour)} 小时前`;
    }

    const days = Math.floor(diff / day);
    const hours = Math.floor((diff % day) / hour);

    if (hours === 0) {
        return `${days} 天前`;
    }

    return `${days} 天 ${hours} 小时前`;
}


async function loadCurrentStatus() {
    const response = await fetch(
        'https://api.wangbaobao.moe/api/current',
        {
            cache: 'no-store'
        }
    );

    if (!response.ok) {
        throw new Error(`目前数据加载失败: ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
        throw new Error(data.error || '目前数据加载失败');
    }

    return data;
}


function createStatusItem(label, value) {
    const item = document.createElement('div');
    item.className = 'current-status-item';

    item.innerHTML = `
        <span class="current-status-label">${label}</span>
        <strong class="current-status-value">${value}</strong>
    `;

    return item;
}


export async function renderCurrentStatus() {
    const container = document.getElementById('currentStatusContent');

    if (!container) return;

    container.innerHTML = '<p>正在读取数据...</p>';

    try {
        const data = await loadCurrentStatus();

        container.innerHTML = '';

        let liveText = '未知';

        if (data.liveStatus === 1) {
            liveText = '直播中';
        } else if (data.liveStatus === 0) {
            liveText = '未开播';
        } else if (data.liveStatus === 2) {
            liveText = '轮播';
        }

        container.append(
            createStatusItem('当前状态', liveText),
            createStatusItem(
                '粉丝数',
                Number(data.followers).toLocaleString()
            ),
            createStatusItem(
                '舰长数',
                Number(data.guards).toLocaleString()
            )
        );

        const updated = document.createElement('p');
        updated.className = 'current-status-updated';
        updated.textContent =
            `最后更新：${new Date(data.updatedAt).toLocaleString()}`;

        container.appendChild(updated);

    } catch (error) {
        console.error(error);

        container.innerHTML = `
            <p class="current-status-error">
                目前数据加载失败
            </p>
        `;
    }
}