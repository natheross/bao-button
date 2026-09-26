import { infoApiUrl, fetchJson, showUpdateError } from './api.js';

const PREDICTION_URL = infoApiUrl('/api/prediction');
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const SVG_NS = 'http://www.w3.org/2000/svg';
let chartResizeObserver;

function shortTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString('zh-CN', {
        timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false,
    });
}

function beijingDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
}

function nextSevenDates(generatedAt) {
    const day = String(generatedAt).slice(0, 10);
    const first = new Date(`${day}T00:00:00Z`);
    if (Number.isNaN(first.getTime())) return [];
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(first.getTime() + index * 86400000);
        return {
            weekday: (date.getUTCDay() + 6) % 7,
            label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
        };
    });
}

function svgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, String(value));
    }
    return element;
}

function predictionTooltipContent(point, probability) {
    const content = document.createDocumentFragment();
    const endTime = new Date(Date.parse(point.time) + 30 * 60_000);
    const time = document.createElement('div');
    time.className = 'prediction-popover-time';
    time.textContent = `${beijingDateTime(point.time)}–${shortTime(endTime)}`;
    const chance = document.createElement('strong');
    chance.className = 'prediction-popover-chance';
    chance.textContent = `开播概率 ${(probability * 100).toFixed(1)}%`;
    const history = document.createElement('div');
    history.className = 'prediction-popover-history';
    const recentStarts = point.recentStartsInWindow;
    if (!Array.isArray(recentStarts)) {
        history.textContent = '历史记录暂不可用';
    } else if (!recentStarts.length) {
        history.textContent = '此时间点暂无开播记录';
    } else {
        const label = document.createElement('span');
        label.textContent = '该时段最近 3 次开播';
        const list = document.createElement('ul');
        for (const start of recentStarts.slice(0, 3)) {
            const item = document.createElement('li');
            item.textContent = beijingDateTime(start);
            list.appendChild(item);
        }
        history.append(label, list);
    }
    content.append(time, chance, history);
    return content;
}

function predictionChart(points, levels, width = 760, height = 320) {
    const left = 56;
    const right = 18;
    const top = 18;
    const bottom = height - 48;
    const values = points.map(point => Number(point.probability));
    const ceiling = Math.min(1, Math.max(0.4, Math.ceil(Math.max(...values) * 10) / 10));
    const x = index => left + index * (width - left - right) / (points.length - 1);
    const y = value => bottom - value / ceiling * (bottom - top);
    const chart = document.createElement('div');
    chart.className = 'prediction-chart-wrap';
    const svg = svgElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        role: 'group',
        'aria-label': `未来两小时开播倾向曲线；中危从 ${(levels.medium * 100).toFixed(0)}% 起，高危从 ${(levels.high * 100).toFixed(0)}% 起`,
        class: 'prediction-chart',
    });
    const popover = document.createElement('div');
    popover.className = 'prediction-popover';
    popover.id = 'prediction-point-tooltip';
    popover.setAttribute('role', 'tooltip');
    popover.hidden = true;
    const hidePopover = () => { popover.hidden = true; };
    const showPopover = index => {
        popover.replaceChildren(predictionTooltipContent(points[index], values[index]));
        popover.hidden = false;
        const chartWidth = chart.getBoundingClientRect().width;
        const pointX = chartWidth * x(index) / width;
        const pointY = chartWidth * y(values[index]) / width;
        const halfWidth = popover.offsetWidth / 2;
        const center = Math.max(halfWidth,
            Math.min(pointX, chartWidth - halfWidth));
        popover.style.left = `${center}px`;
        popover.style.top = `${pointY}px`;
        popover.style.setProperty('--prediction-arrow-offset', `${pointX - center}px`);
    };
    const stepWidth = (width - left - right) / (points.length - 1);
    const defs = svgElement('defs');
    for (const level of ['medium', 'high']) {
        const pattern = svgElement('pattern', {
            id: `prediction-hatch-${level}`, width: 8, height: 8,
            patternUnits: 'userSpaceOnUse',
        });
        pattern.appendChild(svgElement('path', {
            d: 'M-2,2 L2,-2 M0,8 L8,0 M6,10 L10,6',
            class: `prediction-hatch prediction-risk-${level}`,
        }));
        defs.appendChild(pattern);
    }
    svg.appendChild(defs);
    // 同等级的连续时段合为一个区域，只在区域两端画边界。
    for (let index = 0; index < points.length; index++) {
        const level = points[index].level;
        if (level !== 'medium' && level !== 'high') continue;
        const start = index;
        while (index + 1 < points.length && points[index + 1].level === level) index++;
        const startX = Math.max(left, x(start) - stepWidth / 2);
        const endX = Math.min(width - right, x(index) + stepWidth / 2);
        const rect = { x: startX, y: top, width: endX - startX, height: bottom - top };
        svg.append(
            svgElement('rect', { ...rect, class: `prediction-band-${level}` }),
            svgElement('rect', { ...rect, fill: `url(#prediction-hatch-${level})` }),
            svgElement('path', {
                d: `M${startX},${top} V${bottom} M${endX},${top} V${bottom}`,
                class: `prediction-risk-boundary prediction-risk-${level}`,
            }),
        );
    }
    // 北京时间的整点、半点；不随预测起点（例如 10:20）偏移。
    const halfHour = 30 * 60_000;
    const times = points.map(point => Date.parse(point.time));
    for (let time = Math.ceil(times[0] / halfHour) * halfHour; time <= times.at(-1); time += halfHour) {
        const next = times.findIndex(value => value >= time);
        const previous = Math.max(0, next - 1);
        const position = next === previous ? x(next)
            : x(previous) + (x(next) - x(previous)) * (time - times[previous]) / (times[next] - times[previous]);
        svg.appendChild(svgElement('line', {
            x1: position, x2: position, y1: top, y2: bottom,
            class: 'prediction-gridline prediction-time-gridline',
        }));
    }
    const ticks = [...new Set([0, levels.medium, levels.high, ceiling])].sort((a, b) => a - b);
    for (const tick of ticks) {
        const grid = svgElement('line', {
            x1: left, x2: width - right, y1: y(tick), y2: y(tick),
            class: 'prediction-gridline',
        });
        const label = svgElement('text', {
            x: left - 8, y: y(tick) + 4, 'text-anchor': 'end',
            class: 'prediction-axis-label',
        });
        label.textContent = `${Math.round(tick * 100)}%`;
        svg.append(grid, label);
    }
    const path = svgElement('polyline', {
        points: values.map((value, index) => `${x(index)},${y(value)}`).join(' '),
        class: 'prediction-line',
    });
    svg.appendChild(path);
    for (let index = 0; index < points.length; index++) {
        const point = points[index];
        const marker = svgElement('g', { class: 'prediction-point' });
        const circle = svgElement('circle', {
            cx: x(index), cy: y(values[index]), r: 5,
            class: 'prediction-dot',
        });
        const hitArea = svgElement('circle', {
            cx: x(index), cy: y(values[index]), r: 12,
            class: 'prediction-hit-area', tabindex: 0,
            'aria-label': `${beijingDateTime(point.time)} 开播概率 ${(values[index] * 100).toFixed(1)}%，查看该时段开播记录`,
            'aria-describedby': popover.id,
        });
        hitArea.addEventListener('pointerenter', () => showPopover(index));
        hitArea.addEventListener('pointerleave', hidePopover);
        hitArea.addEventListener('focus', () => showPopover(index));
        hitArea.addEventListener('blur', hidePopover);
        marker.append(circle, hitArea);
        svg.appendChild(marker);
    }
    for (const index of [0, Math.floor((points.length - 1) / 2), points.length - 1]) {
        const label = svgElement('text', {
            x: x(index), y: height - 16, 'text-anchor': index === 0 ? 'start'
                : index === points.length - 1 ? 'end' : 'middle',
            class: 'prediction-axis-label',
        });
        label.textContent = shortTime(points[index].time);
        svg.appendChild(label);
    }
    chart.append(svg, popover);
    return chart;
}

export async function renderPrediction() {
    const container = document.getElementById('predictionContent');
    if (!container) return;
    const hasData = !!container.querySelector('.prediction-layout');
    if (!hasData) container.textContent = '正在读取预测...';
    try {
        const data = await fetchJson(PREDICTION_URL, '预测');
        if (!data.ok || !Array.isArray(data.forecast?.points)) {
            throw new Error('预测数据格式错误');
        }
        const points = data.forecast.points;
        const levels = data.forecast.levels;
        if (points.length < 2 || !points.every(point => Number.isFinite(Number(point.probability)))
            || !Number.isFinite(Number(levels?.medium)) || !Number.isFinite(Number(levels?.high))) {
            throw new Error('预测曲线数据不完整');
        }
        const layout = document.createElement('div');
        layout.className = 'prediction-layout';
        const chartPanel = document.createElement('div');
        chartPanel.className = 'prediction-panel prediction-chart-panel';
        const chartHeading = document.createElement('h2');
        chartHeading.className = 'info-subheading';
        chartHeading.textContent = '未来两小时内开播概率';
        const chartHeader = document.createElement('div');
        chartHeader.className = 'prediction-chart-header';
        const legend = document.createElement('div');
        legend.className = 'prediction-legend';
        for (const [level, text] of [
            ['medium', '中危险 此时段突击概率稍高'],
            ['high', '高危险 此时段突击概率较高'],
        ]) {
            const item = document.createElement('span');
            item.className = 'prediction-legend-item';
            const swatch = document.createElement('span');
            swatch.className = `prediction-legend-swatch prediction-risk-${level}`;
            swatch.setAttribute('aria-hidden', 'true');
            item.append(swatch, text);
            legend.appendChild(item);
        }
        chartHeader.append(chartHeading, legend);
        const chartNote = document.createElement('p');
        chartNote.className = 'prediction-chart-note';
        chartNote.textContent = '节假日附近等宝煲空闲时间陡增的情况会出现较大偏差';
        const chartHost = document.createElement('div');
        chartHost.className = 'prediction-chart-host';
        chartPanel.append(chartHeader, chartHost, chartNote);
        layout.appendChild(chartPanel);
        if (Array.isArray(data.weeklyPatterns?.patterns) && data.weeklyPatterns.patterns.length) {
            const historyPanel = document.createElement('div');
            historyPanel.className = 'prediction-panel';
            const heading = document.createElement('h2');
            heading.className = 'info-subheading';
            heading.textContent = '近期出没危险期';
            const patterns = document.createElement('div');
            patterns.className = 'prediction-list';
            const patternByWeekday = new Map(data.weeklyPatterns.patterns.map(
                pattern => [pattern.weekday, pattern]
            ));
            for (const day of nextSevenDates(data.generatedAt)) {
                const pattern = patternByWeekday.get(day.weekday);
                if (!pattern) continue;
                const row = document.createElement('div');
                row.className = 'prediction-row';
                const time = document.createElement('span');
                time.textContent = `${day.label} ${WEEKDAYS[day.weekday]} ${pattern.start}–${pattern.end}`;
                const rate = document.createElement('strong');
                const value = Number(pattern.repeatRate);
                rate.textContent = Number.isFinite(value)
                    ? `${(value * 100).toFixed(0)}%` : '暂无';
                row.append(time, rate);
                patterns.appendChild(row);
            }
            historyPanel.append(heading, patterns);
            layout.appendChild(historyPanel);
        }
        chartResizeObserver?.disconnect();
        container.replaceChildren(layout);
        // 图表跟随卡片可用空间绘制，避免宽屏下按固定宽高比把整行撑高。
        chartResizeObserver = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
                chartHost.replaceChildren(predictionChart(points, levels, width, height));
            }
        });
        chartResizeObserver.observe(chartHost);
        return true;
    } catch (error) {
        console.error(error);
        if (hasData) showUpdateError(container, error);
        else container.textContent = '预测暂时不可用';
        return false;
    }
}
