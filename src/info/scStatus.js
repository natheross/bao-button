import { infoApiUrl, fetchJson, showUpdateError } from './api.js';
import { dishFilename, fishbowlFilename } from './kitchenAssets.js';
import { boardRect, dishRect, ingredientPosition, scallionRect } from './kitchenLayout.js';

const SC_URL = infoApiUrl('/api/sc/current');
const KITCHEN_ASSETS = new URL('../../public/kitchen/', import.meta.url);
let kitchenResizeBound = false;
let sessions = [];
let selectedSessionId = null;
let controlsBound = false;

function positionKitchenLayers() {
    const frame = document.querySelector('.kitchen-scene');
    const board = document.getElementById('kitchenBoard');
    const dish = document.getElementById('kitchenDish');
    const scallions = document.getElementById('kitchenScallions');
    if (!frame || !board || !dish || !scallions || !frame.clientWidth || !frame.clientHeight) return;
    const style = getComputedStyle(frame);
    const x = parseFloat(style.backgroundPositionX) / 100;
    const y = parseFloat(style.backgroundPositionY) / 100;
    const positionX = Number.isFinite(x) ? x : 0.5;
    const positionY = Number.isFinite(y) ? y : 0.5;
    for (const [element, rect] of [
        [board, boardRect(frame.clientWidth, frame.clientHeight, positionX, positionY)],
        [dish, dishRect(dish.dataset.filename, frame.clientWidth, frame.clientHeight,
            positionX, positionY)],
        [scallions, scallionRect(dish.dataset.filename, frame.clientWidth, frame.clientHeight,
            positionX, positionY)],
    ]) {
        for (const side of ['left', 'top', 'width', 'height']) {
            element.style[side] = `${rect[side]}px`;
        }
    }
}

function watchKitchenSize() {
    if (kitchenResizeBound) return;
    const frame = document.querySelector('.kitchen-scene');
    if (!frame) return;
    kitchenResizeBound = true;
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(positionKitchenLayers).observe(frame);
    } else {
        window.addEventListener('resize', positionKitchenLayers);
    }
    positionKitchenLayers();
}

function updateIngredients(zoneId, count, filename, kind) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;
    const validCount = Number.isSafeInteger(count) && count >= 0 ? count : 0;
    if (zone.dataset.count === String(validCount)) return;
    const fragment = document.createDocumentFragment();
    const source = new URL(filename, KITCHEN_ASSETS).href;
    for (let index = 0; index < validCount; index++) {
        const image = document.createElement('img');
        image.className = 'kitchen-ingredient';
        image.src = source;
        image.alt = '';
        image.decoding = 'async';
        const position = ingredientPosition(index, validCount, kind);
        image.style.left = position.left;
        image.style.top = position.top;
        image.style.width = position.width;
        image.style.zIndex = String(position.zIndex);
        fragment.appendChild(image);
    }
    zone.replaceChildren(fragment);
    zone.dataset.count = String(validCount);
}

function updateFishbowl(scene) {
    const image = document.getElementById('kitchenFishbowl');
    if (!image) return;
    const count = !scene ? NaN : scene.scDataAvailable ? Number(scene.counts?.coin) : 0;
    const filename = fishbowlFilename(count);
    image.hidden = !filename;
    if (!filename) return;
    const url = new URL(filename, KITCHEN_ASSETS).href;
    if (image.src !== url) image.src = url;
    image.alt = `钢镚鱼缸`;
}

function updateDish(scene) {
    const image = document.getElementById('kitchenDish');
    if (!image) return;
    const counts = scene?.scDataAvailable ? scene.counts : null;
    const filename = counts ? dishFilename(Number(counts.egg), Number(counts.tomato)) : null;
    image.dataset.filename = filename || '';
    image.hidden = !filename;
    if (!filename) {
        image.removeAttribute('src');
        return;
    }
    const url = new URL(filename, KITCHEN_ASSETS).href;
    if (image.src !== url) image.src = url;
}

function updateScallions(scene) {
    const image = document.getElementById('kitchenScallions');
    if (!image) return;
    const count = scene?.scDataAvailable ? Number(scene.counts?.scallion) : NaN;
    image.hidden = !Number.isSafeInteger(count) || count <= 0;
    if (!image.hidden && !image.hasAttribute('src')) {
        image.src = new URL('葱花.png', KITCHEN_ASSETS).href;
    }
}

function setCount(id, label, scene, key) {
    const element = document.getElementById(id);
    if (!element) return;
    element.hidden = !scene;
    if (scene) {
        const count = scene.scDataAvailable ? Number(scene.counts?.[key]) : NaN;
        const value = Number.isFinite(count) ? count.toLocaleString('zh-CN') : null;
        if (key === 'coin') {
            element.textContent = value === null
                ? '许愿池今日收到钢镚：暂无 XML 记录'
                : `许愿池今日收到钢镚${value}枚`;
        } else if (key === 'scallion') {
            element.textContent = `葱花、糖、盐等调料\n${value === null ? '暂无 XML 记录' : `共${value}个`}`;
        } else {
            element.textContent = `${label} ${value === null ? '暂无 XML 记录' : `${value} 个`}`;
        }
    }
}

function updateKitchen(scene) {
    updateFishbowl(scene);
    updateDish(scene);
    updateScallions(scene);
    positionKitchenLayers();
    const counts = scene?.scDataAvailable ? scene.counts : null;
    updateIngredients('kitchenEggs', Number(counts?.egg), '蛋.png', 'egg');
    updateIngredients('kitchenTomatoes', Number(counts?.tomato), '番茄.png', 'tomato');
    setCount('kitchenCoinCount', '钢镚', scene, 'coin');
    setCount('kitchenSeasoningCount', '葱花', scene, 'scallion');
    setCount('kitchenEggCount', '鸡蛋', scene, 'egg');
    setCount('kitchenTomatoCount', '番茄', scene, 'tomato');
}

function sessionTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '时间未知';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map(({ type, value }) => [type, value]));
    return `${parts.year}.${parts.month}.${parts.day}  ${parts.hour}:${parts.minute}场`;
}

function renderSelectedSession() {
    const index = sessions.findIndex(scene => scene.sessionId === selectedSessionId);
    const scene = sessions[index] || null;
    document.getElementById('kitchenSessionTime').textContent = scene ? sessionTime(scene.startedAt) : '';
    document.getElementById('kitchenPrevious').disabled = index < 0 || index >= sessions.length - 1;
    document.getElementById('kitchenNext').disabled = index <= 0;
    updateKitchen(scene);
}

function bindControls() {
    if (controlsBound) return;
    controlsBound = true;
    document.getElementById('kitchenPrevious').addEventListener('click', () => {
        const index = sessions.findIndex(scene => scene.sessionId === selectedSessionId);
        if (index >= 0 && index < sessions.length - 1) {
            selectedSessionId = sessions[index + 1].sessionId;
            renderSelectedSession();
        }
    });
    document.getElementById('kitchenNext').addEventListener('click', () => {
        const index = sessions.findIndex(scene => scene.sessionId === selectedSessionId);
        if (index > 0) {
            selectedSessionId = sessions[index - 1].sessionId;
            renderSelectedSession();
        }
    });
}

export async function renderScStatus() {
    const container = document.getElementById('scContent');
    if (!container) return;
    watchKitchenSize();
    bindControls();
    if (!sessions.length) {
        container.textContent = '正在读取垫饭煲厨房...';
    }
    try {
        const data = await fetchJson(SC_URL, 'SC');
        if (!data.ok || !Array.isArray(data.sessions)) throw new Error('SC 数据格式错误');
        sessions = data.sessions;
        if (!sessions.some(scene => scene.sessionId === selectedSessionId)) {
            selectedSessionId = sessions[0]?.sessionId ?? null;
        }
        renderSelectedSession();
        container.textContent = sessions.length ? '' : '暂无直播记录';
    } catch (error) {
        console.error(error);
        if (sessions.length) showUpdateError(container, error);
        if (!sessions.length) {
            renderSelectedSession();
            container.textContent = '垫饭煲厨房暂时离线';
        }
    }
}
