import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audioTypes = /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i;
const imageTypes = /\.(png|jpe?g|gif|webp|avif)$/i;
const compare = (a, b) => a.localeCompare(b, 'zh-CN', { numeric: true });

// 编号仅用于排序；Windows 禁用字符可用 %2A 等转义，显示时还原。
export function displayName(name) {
    return name.replace(/^\d+ /, '').replace(/%([0-9a-f]{2})/gi,
        (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function parseEdCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false, closed = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
            if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (char === '"') { quoted = false; closed = true; }
            else cell += char;
        } else if (char === '"' && !cell && !closed) quoted = true;
        else if (char === ',' || char === '\n' || char === '\r') {
            row.push(cell); cell = ''; closed = false;
            if (char !== ',') {
                if (char === '\r' && text[i + 1] === '\n') i++;
                if (row.some(value => value.trim())) rows.push(row);
                row = [];
            }
        } else {
            if (closed || char === '"') throw new Error('ED CSV 引号格式错误');
            cell += char;
        }
    }
    if (quoted) throw new Error('ED CSV 有未闭合的引号');
    row.push(cell);
    if (row.some(value => value.trim())) rows.push(row);
    if (rows.shift()?.join(',') !== '日期,歌名,歌手') throw new Error('ED CSV 表头必须是：日期,歌名,歌手');
    const seen = new Set();
    return rows.map((values, index) => {
        const [rawDate, song, author] = values.map(value => value.trim());
        const parts = rawDate.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        const date = parts ? `${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}` : rawDate;
        if (values.length !== 3 || !song || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date)
            || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date))) {
            throw new Error(`ED 第 ${index + 2} 条格式错误，歌名必填，日期留空或使用 YYYY-MM-DD`);
        }
        const key = JSON.stringify([date, song, author]);
        if (seen.has(key)) throw new Error(`ED 重复记录：${date} ${song}`);
        seen.add(key);
        return { date, song, author };
    }).sort((a, b) => b.date.localeCompare(a.date));
}

async function filesIn(dir, supported) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isSymbolicLink()) throw new Error(`内容目录不接受符号链接：${entry.name}`);
    }
    return entries.filter(entry => entry.isFile() && supported.test(entry.name))
        .map(entry => entry.name).sort(compare);
}

export async function buildContent(projectRoot = root) {
    const content = path.join(projectRoot, '内容');
    const ed = parseEdCsv(await fs.readFile(path.join(content, 'ED记录.csv'), 'utf8'));
    const output = await fs.mkdtemp(path.join(projectRoot, '.content-build-'));
    try {
        const audioDir = path.join(content, '音频');
        const categories = (await fs.readdir(audioDir, { withFileTypes: true }))
            .filter(entry => entry.isDirectory()).map(entry => entry.name).sort(compare);
        const voices = [];
        const tags = {};
        const copies = [];
        for (const [index, category] of categories.entries()) {
            const tag = `category-${index + 1}`;
            tags[tag] = displayName(category);
            for (const file of await filesIn(path.join(audioDir, category), audioTypes)) {
                const relative = `${category}/${file}`;
                voices.push({ messages: { zh: displayName(path.parse(file).name) },
                    path: relative.split('/').map(encodeURIComponent).join('/'), tag });
                copies.push([path.join(audioDir, relative), path.join(output, 'voices', relative)]);
            }
        }
        const memeDir = path.join(content, '表情包');
        const memes = [];
        await fs.mkdir(path.join(output, 'memes', 'thumbs'), { recursive: true });
        for (const file of await filesIn(memeDir, imageTypes)) {
            const thumbnail = `${file}.webp`;
            await sharp(path.join(memeDir, file), { animated: false }).rotate()
                .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 78 }).toFile(path.join(output, 'memes', 'thumbs', thumbnail));
            copies.push([path.join(memeDir, file), path.join(output, 'memes', file)]);
            memes.push({ file, title: displayName(path.parse(file).name), thumbnail });
        }
        for (const [source, target] of copies) {
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.copyFile(source, target);
        }
        await fs.writeFile(path.join(output, 'content.js'),
            `// 自动生成，内容来自“内容”目录。\nexport const voices = ${JSON.stringify(voices, null, 2)};\nexport const zhLocale = ${JSON.stringify({ tags }, null, 2)};\n`);
        for (const [name, data] of [['ed', ed], ['memes', memes]]) {
            await fs.writeFile(path.join(output, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
        }
        const generated = path.resolve(projectRoot, 'generated');
        if (path.dirname(generated) !== path.resolve(projectRoot)) throw new Error('输出目录越界');
        await fs.rm(generated, { recursive: true, force: true });
        await fs.rename(output, generated);
        return { voices, tags, ed, memes };
        } finally {
        if (path.dirname(output) === path.resolve(projectRoot) && path.basename(output).startsWith('.content-build-')) {
            await fs.rm(output, { recursive: true, force: true });
        }
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const data = await buildContent();
    console.log(`已生成 ${data.voices.length} 个音频按钮、${data.memes.length} 个表情包、${data.ed.length} 条 ED`);
    if (process.argv.includes('--site')) {
        const destination = path.join(root, 'site-output');
        if (path.dirname(path.resolve(destination)) !== root) throw new Error('发布目录越界');
        await fs.rm(destination, { recursive: true, force: true });
        await fs.mkdir(destination, { recursive: true });
        for (const name of ['index.html', 'app.js', 'styles.css', 'favicon.jpg', '背景.png', 'CNAME', 'LICENSE', 'src', 'public', 'generated']) {
            await fs.cp(path.join(root, name), path.join(destination, name), { recursive: true });
        }
    }
}
