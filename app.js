// ES模块版本
import { zhLocale } from './src/locales/zh.js';
import { voices } from './src/config/voices.js';
import { CDN_CONFIGS } from './src/config/cdns.js';
import { otherbutton, otherbuttonRemote } from './src/config/otherbutton.js';
import { initInfoPage } from './src/ui/infoPage.js';

const CONCURRENCY_MIX = 5
let AUIDO_URL = ""
let currentPage = 'buttons'

// 全局状态
const state = {
    currentLang: 'zh',
    isLoopMode: false,
    playingAudios: new Map(), // 存储正在播放的音频及其循环状态
    audioCache: new Map(), // 内存缓存已加载的音频Blob
    voices: [],
    locales: {
        zh: zhLocale,
        en: zhLocale, // 暂时使用中文，可后续添加英文
        ja: zhLocale  // 暂时使用中文，可后续添加日文
    },
    totalToLoad: 0,
    loadedCount: 0,
    otherButtons: otherbutton,
    selectedCdn: null, // 新增：选中的CDN
    availableCdns: CDN_CONFIGS || [], // 新增：可用的CDN列表
    isSingleCdnMode: CDN_CONFIGS && CDN_CONFIGS.length === 1, // 判断是否单CDN模式
    isLocalMode: !CDN_CONFIGS || CDN_CONFIGS.length === 0 // 判断是否本地模式
};

// IndexedDB数据库配置
const DB_NAME = 'MaiButtonDB';
const DB_VERSION = 2; // 更新版本号以支持CDN存储
const STORE_NAME = 'audioCache';
const CDN_STORE_NAME = 'cdnSettings'; // 新增：CDN设置存储

// 初始化IndexedDB
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // 创建音频缓存存储
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'path' });
            }

            // 仅在非本地模式下创建CDN设置存储
            if (!state.isLocalMode && !db.objectStoreNames.contains(CDN_STORE_NAME)) {
                const cdnStore = db.createObjectStore(CDN_STORE_NAME, { keyPath: 'id' });
                cdnStore.createIndex('selected', 'selected', { unique: false });
            }
        };
    });
}

// 保存选中的CDN到IndexedDB
async function saveSelectedCdn(cdnId) {
    // 本地模式不需要保存CDN设置
    if (state.isLocalMode) return Promise.resolve(null);

    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CDN_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(CDN_STORE_NAME);

            // 先获取所有记录
            const getAllRequest = store.getAll();

            getAllRequest.onsuccess = () => {
                const records = getAllRequest.result;

                // 清除所有选中状态
                const updatePromises = records.map(record => {
                    if (record.selected) {
                        record.selected = false;
                        return store.put(record);
                    }
                    return null;
                }).filter(p => p !== null);

                // 等待所有更新完成
                Promise.all(updatePromises.map(p =>
                    new Promise((res, rej) => {
                        p.onsuccess = res;
                        p.onerror = rej;
                    })
                )).then(() => {
                    // 保存新的选中状态
                    const cdn = state.availableCdns.find(c => c.id === cdnId);
                    if (cdn) {
                        const cdnData = {
                            id: cdn.id,
                            url: cdn.url,
                            name: cdn.name,
                            selected: true,
                            timestamp: Date.now()
                        };
                        const request = store.put(cdnData);
                        request.onsuccess = () => resolve(cdnData);
                        request.onerror = () => reject(request.error);
                    } else {
                        resolve(null);
                    }
                });
            };

            getAllRequest.onerror = () => reject(getAllRequest.error);
        });
    } catch (error) {
        console.warn('保存CDN设置失败:', error);
        return null;
    }
}

// 从IndexedDB获取选中的CDN
async function getSelectedCdn() {
    // 本地模式不需要获取CDN设置
    if (state.isLocalMode) return Promise.resolve(null);

    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CDN_STORE_NAME], 'readonly');
            const store = transaction.objectStore(CDN_STORE_NAME);

            // 获取所有记录，然后在内存中筛选
            const request = store.getAll();

            request.onsuccess = () => {
                const selectedCdn = request.result.find(cdn => cdn.selected === true);
                resolve(selectedCdn || null);
            };

            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn('获取CDN设置失败:', error);
        return null;
    }
}

// 渲染CDN选择界面
function renderCdnOptions() {
    const container = document.getElementById('cdnOptions');
    if (!container) return;

    container.innerHTML = '';

    state.availableCdns.forEach(cdn => {
        const optionElement = document.createElement('div');
        optionElement.className = 'cdn-option';
        optionElement.dataset.cdnId = cdn.id;

        optionElement.innerHTML = `
            <div class="cdn-option-header">
                <h3>${cdn.name}</h3>
                <span class="cdn-priority">优先级: ${cdn.priority}</span>
            </div>
            <div class="cdn-option-url">${cdn.url}</div>
            <div class="cdn-option-desc">${cdn.description}</div>
        `;

        optionElement.addEventListener('click', () => {
            selectCdn(cdn.id);
        });

        container.appendChild(optionElement);
    });
}

// 选择CDN
async function selectCdn(cdnId) {
    const cdn = state.availableCdns.find(c => c.id === cdnId);
    if (!cdn) return;

    // 更新选中状态
    state.selectedCdn = cdn;

    // 检查是否要记住选择
    const rememberCheckbox = document.getElementById('rememberCdn');
    const remember = rememberCheckbox ? rememberCheckbox.checked : true;

    if (remember && !state.isLocalMode) {
        await saveSelectedCdn(cdnId);
    }

    // 设置音频URL
    AUIDO_URL = cdn.url;

    // 隐藏CDN选择界面，显示加载界面
    const cdnSelectScreen = document.getElementById('cdnSelectScreen');
    if (cdnSelectScreen) {
        cdnSelectScreen.style.display = 'none';
    }

    // 开始加载音频
    startAudioLoading();
}

// 从IndexedDB获取音频
async function getAudioFromCache(path) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(path);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn('从缓存获取音频失败:', error);
        return null;
    }
}

// 保存音频到IndexedDB
async function saveAudioToCache(path, blob) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({
                path,
                blob,
                timestamp: Date.now(),
                cdnUrl: state.selectedCdn ? state.selectedCdn.url : AUIDO_URL // 记录CDN信息
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn('保存音频到缓存失败:', error);
    }
}

// 清理旧的缓存（超过30天）
async function cleanupOldCache() {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const currentCdnUrl = AUIDO_URL;

            request.result.forEach(item => {
                // 清理超过30天的缓存，以及不属于当前CDN的缓存
                if (item.timestamp < thirtyDaysAgo ||
                    (item.cdnUrl && item.cdnUrl !== currentCdnUrl)) {
                    store.delete(item.path);
                }
            });
        };
    } catch (error) {
        console.warn('清理缓存失败:', error);
    }
}

// 预加载音频
async function preloadAudio(voice, updateProgress) {
    const path = voice.path;

    // 先检查内存缓存
    if (state.audioCache.has(path)) {
        state.loadedCount++;
        updateProgress();
        return Promise.resolve();
    }

    // 检查IndexedDB缓存
    const cached = await getAudioFromCache(path);
    if (cached && cached.blob) {
        state.audioCache.set(path, cached.blob);
        state.loadedCount++;
        updateProgress();
        return Promise.resolve();
    }

    // 从网络加载
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `${AUIDO_URL}${path}`, true);
        xhr.responseType = 'blob';

        xhr.onload = async () => {
            if (xhr.status === 200) {
                const blob = xhr.response;
                state.audioCache.set(path, blob);

                // 异步保存到IndexedDB
                saveAudioToCache(path, blob);

                state.loadedCount++;
                updateProgress();
                resolve();
            } else {
                reject(new Error(`加载失败: ${path}`));
            }
        };

        xhr.onerror = () => reject(new Error(`网络错误: ${path}`));
        xhr.send();
    });
}

// 更新加载进度
function updateProgress() {
    const progress = document.getElementById('loadingProgress');
    const progressText = document.getElementById('loadingProgressText');
    const loadingCdnInfo = document.getElementById('loadingCdnInfo');

    if (progress && progressText) {
        const percentage = Math.round((state.loadedCount / state.totalToLoad) * 100);
        progress.style.width = `${percentage}%`;
        progressText.textContent = `${state.loadedCount}/${state.totalToLoad}`;
    }

    // 更新CDN信息显示
    if (loadingCdnInfo) {
        if (state.isLocalMode) {
            loadingCdnInfo.textContent = '音频源: 本地文件 (public/voices/)';
        } else if (state.selectedCdn) {
            loadingCdnInfo.textContent = `音频源: ${state.selectedCdn.name}`;
        }
    }
}

// 批量预加载
async function batchPreload(voices) {
    state.totalToLoad = voices.length;
    state.loadedCount = 0;

    // 更新进度显示
    updateProgress();

    // 并行加载，但控制并发数
    const CONCURRENCY = CONCURRENCY_MIX;
    const batches = [];

    for (let i = 0; i < voices.length; i += CONCURRENCY) {
        const batch = voices.slice(i, i + CONCURRENCY);
        const promises = batch.map(voice =>
            preloadAudio(voice, updateProgress).catch(error => {
                console.warn(`音频 ${voice.path} 预加载失败:`, error);
                state.loadedCount++;
                updateProgress();
            })
        );

        batches.push(Promise.all(promises));
    }

    // 等待所有批次完成
    for (const batch of batches) {
        await batch;
    }
}

// 开始音频加载（从原来的init函数中提取）
async function startAudioLoading() {
    try {
        // 显示加载界面
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }

        // 设置音频数据
        state.voices = voices;

        // 清理旧缓存
        await cleanupOldCache();

        // 预加载音频
        await batchPreload(state.voices);

        // 显示主界面
        showMainContent();

        // 渲染音频按钮
        renderVoiceButtons();

        // 绑定事件
        bindEvents();

        // 绑定 scroll-spy
        bindScrollSpy();

        loadRemoteOtherButtons();

        console.log('初始化完成，已加载音频:', state.voices.length);
        if (state.isLocalMode) {
            console.log('使用本地文件模式');
        } else if (state.selectedCdn) {
            console.log('使用的CDN:', state.selectedCdn.name);
        }
    } catch (error) {
        console.error('初始化失败:', error);
        // 即使预加载失败，也显示界面
        showMainContent();
        state.voices = voices;
        renderVoiceButtons();
        bindEvents();
        bindScrollSpy();
        loadRemoteOtherButtons();
    }
}

// 渲染音频按钮
function renderVoiceButtons() {
    const container = document.getElementById('voiceContainer');
    if (!container) return;

    // 按标签分组
    const groupedVoices = groupVoicesByTag(state.voices);

    // 清空容器
    container.innerHTML = '';

    const tags = Object.keys(groupedVoices);
    // 渲染每个分组
    tags.forEach(tag => {
        const categoryElement = document.createElement('div');
        categoryElement.className = 'voice-category';
        const sectionId = makeSectionId(tag);
        categoryElement.id = sectionId;
        categoryElement.dataset.tag = tag;


        // 渲染分类标题
        const tagName = getLocalizedTag(tag);
        categoryElement.innerHTML = `<h2>${tagName}</h2><div class="voice-buttons"></div>`;

        // 渲染按钮
        const buttonsContainer = categoryElement.querySelector('.voice-buttons');
        groupedVoices[tag].forEach(voice => {
            buttonsContainer.appendChild(createVoiceButton(voice));
        });

        container.appendChild(categoryElement);
    });
    renderSidebarNav(tags);
    renderOtherButton(container);
}

// 按标签分组
function groupVoicesByTag(voices) {
    return voices.reduce((groups, voice) => {
        if (!groups[voice.tag]) {
            groups[voice.tag] = [];
        }
        groups[voice.tag].push(voice);
        return groups;
    }, {});
}

function makeSectionId(tag) {
    return `section-${String(tag).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

// 创建音频按钮
function createVoiceButton(voice) {
    const wrapper = document.createElement('div');
    wrapper.className = 'haruka-button';
    wrapper.dataset.path = voice.path;

    const title = getLocalizedVoiceTitle(voice);
    let buttonHtml = '';

    // 如果标题过长，添加tooltip
    if (title.length > 15) {
        buttonHtml = `
            <div class="tooltip">
                <button>${title.substring(0, 15)}...</button>
                <span class="tooltip-text">${title}</span>
            </div>
        `;
    } else {
        buttonHtml = `<button>${title}</button>`;
    }

    wrapper.innerHTML = buttonHtml;

    // 添加点击事件
    wrapper.querySelector('button').addEventListener('click', () => {
        playVoice(voice);
    });

    return wrapper;
}

function renderSidebarNav(tags) {
    const nav = document.getElementById('sidebarNav');
    if (!nav) return;

    nav.innerHTML = '';

    tags.forEach((tag, idx) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'sidebar-item';
        if (idx === 0) item.classList.add('active');

        item.dataset.tag = tag;

        setSidebarItemContent(item, getLocalizedTag(tag));

        item.addEventListener('click', () => {
            scrollToSection(tag);
        });

        nav.appendChild(item);
    });

    const otherItem = document.createElement('button');
    otherItem.type = 'button';
    otherItem.className = 'sidebar-item';
    otherItem.dataset.tag = 'otherbutton';
    setSidebarItemContent(otherItem, '🔗　其他按钮');

    otherItem.addEventListener('click', () => {
        scrollToSection('otherbutton');
    });

    nav.appendChild(otherItem);
}

function setSidebarItemContent(item, title) {
    const divider = title.indexOf('　');
    if (divider < 0) {
        item.textContent = title;
        return;
    }

    const icon = document.createElement('span');
    icon.className = 'sidebar-item-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = title.slice(0, divider);

    const label = document.createElement('span');
    label.className = 'sidebar-item-label';
    label.textContent = title.slice(divider + 1);

    item.setAttribute('aria-label', label.textContent);
    item.append(icon, label);
}

function scrollToSection(tag) {
    const scroller = document.getElementById('contentScroll');
    if (!scroller) return;

    const sectionId = makeSectionId(tag);
    const section = document.getElementById(sectionId);
    if (!section) return;

    const targetTop = scroller.scrollTop
        + section.getBoundingClientRect().top
        - scroller.getBoundingClientRect().top
        - 16;

    scroller.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth'
    });
}

function keepSidebarItemInView(item) {
    const nav = document.getElementById('sidebarNav');
    if (!nav || !item) return;

    const navRect = nav.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    const offset = 12; // 上下留白

    // item 在 nav 可视区上方
    if (itemRect.top < navRect.top + offset) {
        nav.scrollBy({
            top: itemRect.top - navRect.top - offset,
            behavior: 'smooth'
        });
    }
    // item 在 nav 可视区下方
    else if (itemRect.bottom > navRect.bottom - offset) {
        nav.scrollBy({
            top: itemRect.bottom - navRect.bottom + offset,
            behavior: 'smooth'
        });
    }
}

function bindScrollSpy() {
    const scroller = document.getElementById('contentScroll');
    if (!scroller) return;

    const sections = Array.from(
        scroller.querySelectorAll('.voice-category')
    );

    const sidebarItems = Array.from(
        document.querySelectorAll('.sidebar-item')
    );

    if (!sections.length || !sidebarItems.length) return;

    scroller.addEventListener('scroll', () => {
        const activationLine = scroller.getBoundingClientRect().top + 42;
        let currentTag = sections[0].dataset.tag;

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            if (section.getBoundingClientRect().top <= activationLine) {
                currentTag = section.dataset.tag;
            } else {
                break;
            }
        }

        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
            currentTag = sections[sections.length - 1].dataset.tag;
        }

        sidebarItems.forEach(item => {
            const isActive = item.dataset.tag === currentTag;
            item.classList.toggle('active', isActive);
            if (isActive) keepSidebarItemInView(item);
        });
    });
}

function normalizeOtherButtonUrl(url) {
    try {
        const parsed = new URL(url);
        parsed.hash = '';
        parsed.search = '';
        parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
        return parsed.toString().replace(/\/$/, '');
    } catch (error) {
        return String(url || '').trim().replace(/\/$/, '');
    }
}

function buildOtherButtonRemoteUrl() {
    const url = new URL(otherbuttonRemote.endpoint);
    Object.entries(otherbuttonRemote.params || {}).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            url.searchParams.set(key, value.join(','));
        } else if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    });
    return url.toString();
}

function mergeOtherButtons(localButtons, remoteButtons) {
    const usedUrls = new Set();
    const selfUrl = normalizeOtherButtonUrl(otherbuttonRemote.selfUrl);
    const result = [];
    const remoteByUrl = new Map();

    remoteButtons.forEach(item => {
        const normalizedUrl = normalizeOtherButtonUrl(item.url);
        if (!normalizedUrl || normalizedUrl === selfUrl || remoteByUrl.has(normalizedUrl)) return;

        remoteByUrl.set(normalizedUrl, item);
    });

    localButtons.forEach(item => {
        const normalizedUrl = normalizeOtherButtonUrl(item.url);
        if (!normalizedUrl || usedUrls.has(normalizedUrl)) return;

        const remoteItem = remoteByUrl.get(normalizedUrl);
        usedUrls.add(normalizedUrl);
        result.push({
            ...item,
            title: remoteItem?.title || item.title
        });
    });

    remoteButtons.forEach(item => {
        const normalizedUrl = normalizeOtherButtonUrl(item.url);
        if (!normalizedUrl || normalizedUrl === selfUrl || usedUrls.has(normalizedUrl)) return;

        usedUrls.add(normalizedUrl);
        result.push(item);
    });

    return result;
}

async function loadRemoteOtherButtons() {
    if (!otherbuttonRemote.enabled || !otherbuttonRemote.endpoint) return;

    try {
        const response = await fetch(buildOtherButtonRemoteUrl());
        const data = await response.json();

        if (!response.ok || !data.success || !Array.isArray(data.data?.list)) {
            throw new Error('Invalid otherbutton remote response');
        }

        const remoteButtons = data.data.list.map(item => ({
            title: item.name || item.author || item.url,
            url: item.url
        }));

        state.otherButtons = mergeOtherButtons(otherbutton, remoteButtons);
        renderOtherButtonSection();
    } catch (error) {
        console.warn('加载远端其他按钮失败，继续使用本地配置:', error);
    }
}

function renderOtherButtonSection() {
    const section = document.getElementById(makeSectionId('otherbutton'));
    if (!section) return;

    const btnBox = section.querySelector('.voice-buttons');
    if (!btnBox) return;

    btnBox.innerHTML = '';
    state.otherButtons.forEach(item => {
        const wrapper = document.createElement('div');
        wrapper.className = 'haruka-button';

        const btn = document.createElement('button');
        btn.textContent = item.title;

        // 为按钮设置专属颜色；远端按钮不带颜色时走 CSS 默认值
        if (item.color) {
            btn.style.setProperty('--other-main', item.color);
        }
        if (item.light) {
            btn.style.setProperty('--other-light', item.light);
        }

        btn.addEventListener('click', () => {
            window.open(item.url, '_blank');
        });

        wrapper.appendChild(btn);
        btnBox.appendChild(wrapper);
    });
}

function renderOtherButton(container) {
    const section = document.createElement('div');
    section.className = 'voice-category';
    section.id = makeSectionId('otherbutton');
    section.dataset.tag = 'otherbutton';

    section.innerHTML = `
      <h2>🔗　其他按钮</h2>
      <div class="voice-buttons other-buttons"></div>
    `;

    container.appendChild(section);
    renderOtherButtonSection();
}


// 获取本地化的标签名
function getLocalizedTag(tag) {
    return state.locales[state.currentLang].tags[tag] || tag;
}

// 获取本地化的音频标题
function getLocalizedVoiceTitle(voice) {
    return voice.messages[state.currentLang] ||
        voice.messages.zh ||
        Object.values(voice.messages)[0] ||
        '未知音频';
}

// 播放音频
async function playVoice(voice) {
    const path = voice.path;

    // 从缓存获取Blob
    let blob = state.audioCache.get(path);

    if (!blob) {
        // 如果内存中没有，尝试从IndexedDB加载
        const cached = await getAudioFromCache(path);
        if (cached && cached.blob) {
            blob = cached.blob;
            state.audioCache.set(path, blob);
        } else {
            // 回退到直接加载
            const audio = new Audio(`${AUIDO_URL}${path}`);
            playAudioElement(audio, voice);
            return;
        }
    }

    // 从Blob创建音频对象
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);

    playAudioElement(audio, voice, () => {
        // 播放完成后释放URL
        URL.revokeObjectURL(audioUrl);
    });
}

// 播放音频元素
function playAudioElement(audio, voice, cleanupCallback) {
    const wrapper = document.querySelector(`.haruka-button[data-path="${voice.path}"]`);
    const btn = wrapper ? wrapper.querySelector('button') : null;
    if (!btn) return;

    // 创建进度条
    const progressMask = document.createElement('span');
    progressMask.className = 'process-mask';
    btn.appendChild(progressMask);
    btn.classList.add('is-playing');

    // 生成唯一标识符
    const audioId = `${voice.path}-${Date.now()}`;

    // 存储音频实例
    state.playingAudios.set(audioId, {
        audio: audio,
        path: voice.path,
        progressMask: progressMask,
        voice: voice,
        cleanup: cleanupCallback
    });

    // 播放音频
    audio.play().then(() => {
        // 设置进度条动画
        const duration = audio.duration || 3;
        progressMask.style.transition = `width ${duration}s linear`;
        progressMask.style.width = '100%';

        // 音频结束时处理
        audio.onended = () => {
            cleanupAudio(audioId);

            // 如果开启循环模式，重新播放当前音频
            if (state.isLoopMode) {
                playVoice(voice);
            }
        };

        // 错误处理
        audio.onerror = () => {
            console.error(`音频播放错误: ${voice.path}`);
            cleanupAudio(audioId);
        };
    }).catch(error => {
        console.error('播放失败:', error);
        cleanupAudio(audioId);
    });
}

// 清理音频资源
function cleanupAudio(audioId) {
    const item = state.playingAudios.get(audioId);
    if (item) {
        if (item.cleanup) item.cleanup();
        const btn = item.progressMask.parentElement;
        item.progressMask.remove();
        if (btn && !btn.querySelector('.process-mask')) btn.classList.remove('is-playing');
        state.playingAudios.delete(audioId);
    }
}

// 停止所有音频
function stopAllVoices() {
    state.playingAudios.forEach(item => {
        item.audio.pause();
        if (item.cleanup) item.cleanup();
        const btn = item.progressMask.parentElement;
        item.progressMask.remove();
        if (btn) btn.classList.remove('is-playing');
    });

    state.playingAudios.clear();
}

// 随机播放
function playRandomVoice() {
    const randomIndex = Math.floor(Math.random() * state.voices.length);
    playVoice(state.voices[randomIndex]);
}

// 显示CDN选择界面
function showCdnSelect() {
    const mainContent = document.getElementById('mainContent');
    const cdnSelectScreen = document.getElementById('cdnSelectScreen');

    if (mainContent) mainContent.style.display = 'none';
    if (cdnSelectScreen) cdnSelectScreen.style.display = 'flex';

    // 停止所有音频
    stopAllVoices();

    // 重新渲染CDN选项
    renderCdnOptions();
}

// 绑定事件
function bindEvents() {
    const buttonTab = document.getElementById('buttonTab');
    const infoTab = document.getElementById('infoTab');

    if (buttonTab) {
        buttonTab.addEventListener('click', () => setCurrentPage('buttons'));
    }

    if (infoTab) {
        infoTab.addEventListener('click', () => setCurrentPage('info'));
    }

    // 随机播放
    const randomPlayBtn = document.getElementById('randomPlay');
    if (randomPlayBtn) {
        randomPlayBtn.addEventListener('click', playRandomVoice);
    }

    // 停止所有
    const stopAllBtn = document.getElementById('stopAll');
    if (stopAllBtn) {
        stopAllBtn.addEventListener('click', stopAllVoices);
    }

    // 循环模式切换
    const loopModeCheckbox = document.getElementById('loopMode');
    if (loopModeCheckbox) {
        loopModeCheckbox.addEventListener('change', (e) => {
            state.isLoopMode = e.target.checked;
        });
    }

    // CDN切换按钮 - 仅在多个CDN时显示
    const changeCdnBtn = document.getElementById('changeCdn');
    if (changeCdnBtn) {
        if (state.isLocalMode || state.isSingleCdnMode) {
            // 本地模式或单CDN模式，隐藏切换按钮
            changeCdnBtn.style.display = 'none';
        } else {
            changeCdnBtn.addEventListener('click', showCdnSelect);
        }
    }

    // Sidebar 折叠/展开（两阶段，避免文字闪现）
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mainContent = document.getElementById('mainContent');

    if (sidebarToggle && mainContent) {
        const toggleIcon = sidebarToggle.querySelector('.sidebar-toggle-icon');
        sidebarToggle.addEventListener('click', () => {
            if (mainContent.classList.contains('sidebar-animating')) return;

            const isCollapsed = mainContent.classList.contains('sidebar-collapsed');
            mainContent.classList.add('sidebar-animating');

            const shell = mainContent.querySelector('.app-shell');
            const finish = (event) => {
                if (event && (event.target !== shell || event.propertyName !== 'grid-template-columns')) return;
                window.clearTimeout(fallback);
                shell.removeEventListener('transitionend', finish);
                mainContent.classList.remove('sidebar-animating');
                mainContent.classList.remove('sidebar-collapsing');
                mainContent.classList.remove('sidebar-expanding');
            };

            shell.addEventListener('transitionend', finish);
            const fallback = window.setTimeout(finish, 350);

            if (!isCollapsed) {
                // 展开 -> 收起
                toggleIcon.textContent = '☰';
                mainContent.classList.add('sidebar-collapsing');
                mainContent.classList.add('sidebar-collapsed');
            } else {
                // 收起 -> 展开
                toggleIcon.textContent = '❮';
                mainContent.classList.add('sidebar-expanding');
                mainContent.classList.remove('sidebar-collapsed');
            }
        });

    }

}

function setCurrentPage(page) {
    if (page !== 'buttons' && page !== 'info') return;
    if (page === currentPage) return;

    currentPage = page;

    const isButtonPage = currentPage === 'buttons';
    const buttonPage = document.getElementById('buttonPage');
    const infoPage = document.getElementById('infoPage');
    const topbarControls = document.querySelector('.topbar-controls');
    const buttonSidebarNav = document.getElementById('sidebarNav');
    const infoSidebarNav = document.getElementById('infoSidebarNav');
    const buttonTab = document.getElementById('buttonTab');
    const infoTab = document.getElementById('infoTab');

    if (buttonPage) buttonPage.hidden = !isButtonPage;
    if (infoPage) infoPage.hidden = isButtonPage;
    if (topbarControls) topbarControls.style.display = isButtonPage ? '' : 'none';
    if (buttonSidebarNav) buttonSidebarNav.hidden = !isButtonPage;
    if (infoSidebarNav) infoSidebarNav.hidden = isButtonPage;

    if (buttonTab) {
        buttonTab.classList.toggle('active', isButtonPage);
        buttonTab.setAttribute('aria-selected', String(isButtonPage));
    }

    if (infoTab) {
        infoTab.classList.toggle('active', !isButtonPage);
        infoTab.setAttribute('aria-selected', String(!isButtonPage));
    }

    restartPageAnimation(isButtonPage ? buttonPage : infoPage, 'page-fade-enter');
    restartPageAnimation(isButtonPage ? buttonSidebarNav : infoSidebarNav, 'page-fade-enter');
    if (isButtonPage) restartPageAnimation(topbarControls, 'page-fade-enter');
    if (!isButtonPage) {initInfoPage();}
}

function restartPageAnimation(element, className) {
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
}

// 隐藏加载界面，显示主界面
function showMainContent() {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContent = document.getElementById('mainContent');

    if (loadingScreen) loadingScreen.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
}

// 初始化
async function init() {
    try {
        // 判断模式
        if (state.isLocalMode) {
            // 本地模式，直接使用本地路径
            console.log('使用本地文件模式');
            AUIDO_URL = './public/voices/';
            startAudioLoading();
        } else if (state.isSingleCdnMode) {
            // 只有一个CDN，直接使用
            console.log('使用单CDN模式');
            const cdn = state.availableCdns[0];
            state.selectedCdn = cdn;
            AUIDO_URL = cdn.url;
            startAudioLoading();
        } else {
            // 多个CDN，需要选择
            console.log('使用多CDN选择模式');

            // 渲染CDN选项
            renderCdnOptions();

            // 检查是否有保存的CDN选择
            const savedCdn = await getSelectedCdn();

            if (savedCdn) {
                // 直接使用保存的CDN，跳过选择界面
                await selectCdn(savedCdn.id);
            } else {
                // 显示CDN选择界面
                const cdnSelectScreen = document.getElementById('cdnSelectScreen');
                if (cdnSelectScreen) {
                    cdnSelectScreen.style.display = 'flex';
                }
            }
        }
    } catch (error) {
        console.error('初始化失败:', error);
        // 失败时尝试回退
        if (state.availableCdns.length > 0) {
            // 尝试使用第一个CDN
            await selectCdn(state.availableCdns[0].id);
        } else {
            // 回退到本地模式
            state.isLocalMode = true;
            AUIDO_URL = 'public/voices/';
            startAudioLoading();
        }
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
