import { renderCurrentStatus } from '../info/currentStatus.js';

let initialized = false;

export async function initInfoPage() {
    if (initialized) return;

    initialized = true;

    const nav = document.getElementById('infoSidebarNav');

    if (nav) {
        nav.innerHTML = '';

        const item = document.createElement('button');

        item.type = 'button';
        item.className = 'sidebar-item active';
        item.textContent = '📊　目前数据';

        item.addEventListener('click', () => {
            const section = document.getElementById('currentStatusSection');

            if (section) {
                section.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });

        nav.appendChild(item);
    }

    await renderCurrentStatus();
}