import { renderCurrentStatus } from '../info/currentStatus.js';
import { renderScStatus } from '../info/scStatus.js';
import { renderPrediction } from '../info/predictionStatus.js';
import { renderEdStatus, updateEdResults } from '../info/edStatus.js';
import { setMemeGalleryExpanded } from '../info/memeGallery.js';

const sections = [
    { id: 'currentStatusSection', label: '📊　目前数据' },
    { id: 'edSection', label: '🎵　ED 记录' },
    { id: 'memeSection', label: '🖼️　表情包分享库' },
    { id: 'scSection', label: '🍅　番茄炒蛋' },
    { id: 'predictionSection', label: '📈　宝煲行为学' },
];
let initialized = false;
let active = false;
let scTimer = null;
let predictionLoaded = false;
let edLoaded = false;
let refreshQueued = false;

function nearViewport(element) {
    const bounds = element.getBoundingClientRect();
    return bounds.bottom > -100 && bounds.top < window.innerHeight + 100;
}

function stopScPolling() {
    if (scTimer !== null) {
        window.clearInterval(scTimer);
        scTimer = null;
    }
}

function refreshVisibleSections() {
    if (!initialized || !active || document.hidden) {
        stopScPolling();
        return;
    }
    const sc = document.getElementById('scSection');
    if (sc && nearViewport(sc)) {
        if (scTimer === null) {
            renderScStatus();
            scTimer = window.setInterval(() => {
                if (active && !document.hidden && nearViewport(sc)) renderScStatus();
            }, 4 * 60_000);
        }
    } else {
        stopScPolling();
    }
    const prediction = document.getElementById('predictionSection');
    if (!predictionLoaded && prediction && nearViewport(prediction)) {
        predictionLoaded = true;
        renderPrediction();
    }
    const ed = document.getElementById('edSection');
    if (!edLoaded && ed && nearViewport(ed)) {
        edLoaded = true;
        renderEdStatus();
    }

    let current = sections[0].id;
    for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= window.innerHeight * 0.3) {
            current = section.id;
        }
    }
    for (const button of document.querySelectorAll('[data-info-section]')) {
        button.classList.toggle('active', button.dataset.infoSection === current);
    }
}

function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.requestAnimationFrame(() => {
        refreshQueued = false;
        refreshVisibleSections();
    });
}

export function setInfoPageActive(value) {
    active = value;
    if (!active) stopScPolling();
    else queueRefresh();
}

export function initInfoPage() {
    if (initialized) return;
    initialized = true;

    const nav = document.getElementById('infoSidebarNav');
    if (nav) {
        nav.replaceChildren();
        for (const section of sections) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'sidebar-item';
            button.dataset.infoSection = section.id;
            button.textContent = section.label;
            button.addEventListener('click', () => {
                document.getElementById(section.id)?.scrollIntoView({
                    behavior: 'smooth', block: 'start',
                });
            });
            nav.appendChild(button);
        }
    }

    document.getElementById('edDateFilter')?.addEventListener('input', updateEdResults);
    document.getElementById('edKeywordFilter')?.addEventListener('input', updateEdResults);
    document.getElementById('edClearFilters')?.addEventListener('click', () => {
        const date = document.getElementById('edDateFilter');
        const search = document.getElementById('edKeywordFilter');
        if (date) date.value = '';
        if (search) search.value = '';
        updateEdResults();
    });
    document.getElementById('memeExpand')?.addEventListener('click', event => {
        setMemeGalleryExpanded(event.currentTarget.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('scroll', queueRefresh, { capture: true, passive: true });
    window.addEventListener('resize', queueRefresh, { passive: true });
    document.addEventListener('visibilitychange', queueRefresh);
    renderCurrentStatus();
    queueRefresh();
}
