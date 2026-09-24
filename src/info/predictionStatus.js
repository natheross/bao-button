import { infoApiUrl } from './api.js';

const PREDICTION_URL = infoApiUrl('/api/prediction');
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const SVG_NS = 'http://www.w3.org/2000/svg';

function shortTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString('zh-CN', {
        timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false,
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

function predictionChart(points, levels) {
    const width = 760;
    const height = 320;
    const left = 56;
    const right = 18;
    const top = 18;
    const bottom = 272;
    const values = points.map(point => Number(point.probability));
    const ceiling = Math.min(1, Math.max(0.4, Math.ceil(Math.max(...values) * 10) / 10));
    const x = index => left + index * (width - left - right) / (points.length - 1);
    const y = value => bottom - value / ceiling * (bottom - top);
    const svg = svgElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        role: 'img',
        'aria-label': `未来两小时开播倾向曲线；中危从 ${(levels.medium * 100).toFixed(0)}% 起，高危从 ${(levels.high * 100).toFixed(0)}% 起`,
        class: 'prediction-chart',
    });
    const title = svgElement('title');
    title.textContent = '未来两小时开播倾向与中高危时间带';
    svg.appendChild(title);
    const stepWidth = (width - left - right) / (points.length - 1);
    for (let index = 0; index < points.length; index++) {
        const level = points[index].level;
        if (level !== 'medium' && level !== 'high') continue;
        svg.appendChild(svgElement('rect', {
            x: Math.max(left, x(index) - stepWidth / 2),
            y: top,
            width: Math.min(width - right, x(index) + stepWidth / 2)
                - Math.max(left, x(index) - stepWidth / 2),
            height: bottom - top,
            class: `prediction-band prediction-band-${level}`,
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
        const circle = svgElement('circle', {
            cx: x(index), cy: y(values[index]), r: 3.5,
            class: 'prediction-dot',
        });
        const tooltip = svgElement('title');
        tooltip.textContent = `${shortTime(points[index].time)} · ${(values[index] * 100).toFixed(1)}%`;
        circle.appendChild(tooltip);
        svg.appendChild(circle);
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
    return svg;
}

export async function renderPrediction() {
    const container = document.getElementById('predictionContent');
    if (!container) return;
    container.textContent = '正在读取预测...';
    try {
        const response = await fetch(PREDICTION_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`预测 HTTP ${response.status}`);
        const data = await response.json();
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
        chartPanel.className = 'prediction-panel';
        const chartHeading = document.createElement('h2');
        chartHeading.className = 'info-subheading';
        chartHeading.textContent = '未来两小时内开播概率';
        chartPanel.append(chartHeading, predictionChart(points, levels));
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
        container.replaceChildren(layout);
    } catch (error) {
        console.error(error);
        container.textContent = '预测暂时不可用';
    }
}
