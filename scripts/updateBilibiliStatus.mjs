import fs from 'node:fs/promises';

const UID = '1978636705';
const ROOM_ID = '26872684';

const OUTPUT = new URL('../public/data/current.json', import.meta.url);


// 获取粉丝数
async function fetchFollowerCount() {
    const url =
        `https://api.bilibili.com/x/relation/stat?vmid=${UID}`;

    const response = await fetch(url, {
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36',
            'Referer': `https://space.bilibili.com/${UID}`
        }
    });

    if (!response.ok) {
        throw new Error(`粉丝接口 HTTP ${response.status}`);
    }

    const json = await response.json();

    if (json.code !== 0) {
        throw new Error(
            `粉丝接口失败: code=${json.code}, message=${json.message}`
        );
    }

    return json.data.follower;
}


// 获取直播状态
async function fetchLiveStatus() {
    const url =
        `https://api.live.bilibili.com/room/v1/Room/room_init?id=${ROOM_ID}`;

    const response = await fetch(url, {
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36',
            'Referer': `https://live.bilibili.com/${ROOM_ID}`
        }
    });

    if (!response.ok) {
        throw new Error(`直播接口 HTTP ${response.status}`);
    }

    const json = await response.json();

    if (json.code !== 0) {
        throw new Error(
            `直播接口失败: code=${json.code}, message=${json.message}`
        );
    }

    const data = json.data;

    return {
        status:
            data.live_status === 1
                ? 'live'
                : data.live_status === 2
                    ? 'round'
                    : 'offline',

        startedAt:
            data.live_status === 1 && data.live_time > 0
                ? new Date(data.live_time * 1000).toISOString()
                : null
    };
}


// 读取原来的 current.json
async function readCurrentData() {
    try {
        const raw = await fs.readFile(OUTPUT, 'utf8');
        return JSON.parse(raw);
    } catch {
        return {};
    }
}


async function main() {
    console.log('开始获取 Bilibili 数据...');

    const oldData = await readCurrentData();

    const [followers, live] = await Promise.all([
        fetchFollowerCount(),
        fetchLiveStatus()
    ]);

    const now = new Date().toISOString();

    /*
     * 如果检测到“现在正在直播”，记录这次开播时间。
     *
     * 如果未直播，则暂时保留旧的 lastStartedAt。
     * 后面我们做历史记录时再完善。
     */
    const lastStartedAt =
        live.status === 'live'
            ? live.startedAt
            : oldData.live?.lastStartedAt ?? null;

    const result = {
        ...oldData,

        updatedAt: now,

        account: {
            ...(oldData.account ?? {}),
            followers
        },

        live: {
            ...(oldData.live ?? {}),
            status: live.status,
            startedAt: live.startedAt,
            lastStartedAt
        }
    };

    await fs.writeFile(
        OUTPUT,
        JSON.stringify(result, null, 2) + '\n',
        'utf8'
    );

    console.log('更新完成：');
    console.log(`粉丝数：${followers}`);
    console.log(`直播状态：${live.status}`);
    console.log(`开播时间：${live.startedAt ?? '当前未开播'}`);
}


main().catch(error => {
    console.error('更新失败：', error);
    process.exitCode = 1;
});