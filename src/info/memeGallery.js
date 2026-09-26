import { fetchJson } from './api.js';

const MANIFEST_URL = new URL('../../generated/memes.json', import.meta.url);
const MEME_DIR = new URL('../../generated/memes/', import.meta.url);
const THUMB_DIR = new URL('../../generated/memes/thumbs/', import.meta.url);
const IMAGE_NAME = /^[^/\\]+\.(?:png|jpe?g|gif|webp|avif)$/i;
const THUMB_NAME = /^[^/\\]+\.webp$/i;
const BATCH_SIZE = 24;

let generation = 0;
let entries = [];
let shown = 0;
let overlay = null;
let previouslyFocused = null;

function closeLightbox() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.removeEventListener('keydown', onLightboxKeydown);
    document.body.classList.remove('meme-lightbox-open');
    previouslyFocused?.focus();
    previouslyFocused = null;
}

function onLightboxKeydown(event) {
    if (event.key === 'Escape') closeLightbox();
    else if (event.key === 'ArrowLeft') overlay?.querySelector('[data-meme-prev]')?.click();
    else if (event.key === 'ArrowRight') overlay?.querySelector('[data-meme-next]')?.click();
}

function openLightbox(index) {
    closeLightbox();
    previouslyFocused = document.activeElement;
    overlay = document.createElement('div');
    overlay.className = 'meme-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '查看表情包原图');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'meme-lightbox-close';
    close.textContent = '关闭 ×';
    close.addEventListener('click', closeLightbox);
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.dataset.memePrev = '';
    previous.textContent = '‹';
    previous.setAttribute('aria-label', '上一张');
    const next = document.createElement('button');
    next.type = 'button';
    next.dataset.memeNext = '';
    next.textContent = '›';
    next.setAttribute('aria-label', '下一张');
    const image = document.createElement('img');
    image.className = 'meme-lightbox-image';
    const title = document.createElement('span');
    const save = document.createElement('a');
    save.className = 'meme-lightbox-save';
    save.textContent = '保存原图';
    save.setAttribute('download', '');
    const imageArea = document.createElement('div');
    imageArea.className = 'meme-lightbox-stage';
    imageArea.append(previous, image, next);
    const footer = document.createElement('div');
    footer.className = 'meme-lightbox-footer';
    footer.append(title, save);
    overlay.append(close, imageArea, footer);

    let current = index;
    function show(offset = 0) {
        current = (current + offset + entries.length) % entries.length;
        const entry = entries[current];
        const url = new URL(encodeURIComponent(entry.file), MEME_DIR).href;
        image.src = url;
        image.alt = entry.title || entry.file;
        title.textContent = `${entry.title || entry.file} · ${current + 1} / ${entries.length}`;
        save.href = url;
        save.download = entry.file;
    }
    previous.addEventListener('click', () => show(-1));
    next.addEventListener('click', () => show(1));
    let touchStartX = null;
    let touchStartY = null;
    imageArea.addEventListener('touchstart', event => {
        touchStartX = event.changedTouches[0]?.clientX ?? null;
        touchStartY = event.changedTouches[0]?.clientY ?? null;
    }, { passive: true });
    imageArea.addEventListener('touchend', event => {
        if (touchStartX === null || touchStartY === null) return;
        const deltaX = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
        const deltaY = (event.changedTouches[0]?.clientY ?? touchStartY) - touchStartY;
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
            show(deltaX < 0 ? 1 : -1);
        }
        touchStartX = null;
        touchStartY = null;
    }, { passive: true });
    overlay.addEventListener('click', event => {
        if (event.target === overlay) closeLightbox();
    });
    document.body.appendChild(overlay);
    document.body.classList.add('meme-lightbox-open');
    document.addEventListener('keydown', onLightboxKeydown);
    show();
    close.focus();
}

function appendBatch() {
    const container = document.getElementById('memeContent');
    const grid = container?.querySelector('.meme-grid');
    const more = container?.querySelector('[data-meme-more]');
    const count = container?.querySelector('[data-meme-count]');
    if (!grid || !more || !count) return;
    const end = Math.min(shown + BATCH_SIZE, entries.length);
    for (let index = shown; index < end; index++) {
        const entry = entries[index];
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'meme-card';
        button.setAttribute('aria-label', `查看${entry.title || entry.file}`);
        const img = document.createElement('img');
        img.src = new URL(encodeURIComponent(entry.thumbnail), THUMB_DIR).href;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        const caption = document.createElement('span');
        caption.className = 'meme-caption';
        caption.textContent = entry.title || entry.file;
        button.append(img, caption);
        button.addEventListener('click', () => openLightbox(index));
        grid.appendChild(button);
    }
    shown = end;
    count.textContent = `已显示 ${shown} / ${entries.length} 张`;
    more.hidden = shown >= entries.length;
}

export async function setMemeGalleryExpanded(expanded) {
    const button = document.getElementById('memeExpand');
    const container = document.getElementById('memeContent');
    if (!button || !container) return;
    const current = ++generation;
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', expanded ? '收起表情包分享库' : '展开表情包分享库');
    if (!expanded) {
        closeLightbox();
        entries = [];
        shown = 0;
        container.replaceChildren();
        return;
    }
    container.textContent = '正在读取表情包...';
    try {
        const manifest = await fetchJson(MANIFEST_URL, '表情包清单');
        if (!Array.isArray(manifest)) throw new Error('表情包清单格式错误');
        if (current !== generation) return;
        entries = manifest.filter(entry =>
            IMAGE_NAME.test(entry.file || '') && THUMB_NAME.test(entry.thumbnail || '')
        );
        shown = 0;
        if (!entries.length) {
            container.textContent = '暂无可展示的表情包缩略图';
            return;
        }
        const grid = document.createElement('div');
        grid.className = 'meme-grid';
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'info-refresh meme-more';
        more.dataset.memeMore = '';
        more.textContent = '加载更多';
        more.addEventListener('click', appendBatch);
        const count = document.createElement('p');
        count.className = 'info-note meme-count';
        count.dataset.memeCount = '';
        container.replaceChildren(grid, more, count);
        appendBatch();
    } catch (error) {
        if (current !== generation) return;
        console.error(error);
        container.textContent = '表情包暂时无法读取';
    }
}
