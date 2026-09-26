import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildContent, parseEdCsv, displayName } from '../scripts/build-content.mjs';

test('ED CSV supports BOM, quotes, commas and missing date or author', () => {
    assert.equal(parseEdCsv('日期,歌名,歌手\n2026/9/25,歌曲,')[0].date, '2026-09-25');
    assert.deepEqual(parseEdCsv('\uFEFF日期,歌名,歌手\r\n,"歌名,含逗号",\r\n2026-09-25,"a""b",歌手\r\n'), [
        { date: '2026-09-25', song: 'a"b', author: '歌手' },
        { date: '', song: '歌名,含逗号', author: '' },
    ]);
    for (const row of ['2026-02-30,歌曲,', ',,歌手', ',"未闭合,', ',"歌曲"多余,']) {
        assert.throws(() => parseEdCsv(`日期,歌名,歌手\n${row}`));
    }
    assert.throws(() => parseEdCsv('日期,歌名,歌手\n,歌曲,\n,歌曲,'));
});

test('filename ordering prefixes and escaped characters do not change displayed titles', () => {
    assert.equal(displayName('012 把你的米都给我%2A4'), '把你的米都给我*4');
    assert.equal(displayName('100%25确定'), '100%确定');
    assert.equal(displayName('2026年快乐'), '2026年快乐');
});

test('directory build discovers real filenames and preserves last output on validation failure', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bao-content-test-'));
    try {
        const audio = path.join(root, '内容/音频/01 🐱　我是猫');
        await fs.mkdir(audio, { recursive: true });
        await fs.mkdir(path.join(root, '内容/表情包'));
        await fs.writeFile(path.join(root, '内容/ED记录.csv'), '日期,歌名,歌手\n,歌曲,');
        await fs.writeFile(path.join(audio, '002 两个.MP3'), 'second audio');
        await fs.writeFile(path.join(audio, '001 一个%2A2.mp3'), 'first audio');
        const data = await buildContent(root);
        assert.deepEqual(data.voices.map(v => v.messages.zh), ['一个*2', '两个']);
        assert.equal(data.tags[data.voices[0].tag], '🐱　我是猫');
        assert.equal(await fs.readFile(path.join(root, 'generated/voices', decodeURIComponent(data.voices[1].path)), 'utf8'), 'second audio');
        const previous = await fs.readFile(path.join(root, 'generated/content.js'), 'utf8');
        await fs.writeFile(path.join(root, '内容/ED记录.csv'), '错误表头');
        await assert.rejects(buildContent(root));
        assert.equal(await fs.readFile(path.join(root, 'generated/content.js'), 'utf8'), previous);
        await fs.writeFile(path.join(root, '内容/ED记录.csv'), '日期,歌名,歌手\n,歌曲,');
        await fs.unlink(path.join(audio, '002 两个.MP3'));
        await buildContent(root);
        await assert.rejects(fs.access(path.join(root, 'generated/voices', decodeURIComponent(data.voices[1].path))));
    } finally {
        if (path.dirname(root) === os.tmpdir() && path.basename(root).startsWith('bao-content-test-')) {
            await fs.rm(root, { recursive: true, force: true });
        }
    }
});
