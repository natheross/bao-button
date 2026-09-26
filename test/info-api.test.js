import test from 'node:test';
import assert from 'node:assert/strict';

test('info requests share work, respect cooldowns and recover after timeout', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('{"ok":true}'));
    const previousLocation = globalThis.location;
    globalThis.location = { href: 'https://site.example/', hostname: 'site.example' };
    t.after(() => {
        if (previousLocation === undefined) delete globalThis.location;
        else globalThis.location = previousLocation;
    });
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const { fetchJson } = await import('../src/info/api.js');
    const first = fetchJson('https://api.example/api/current', '数据');
    const second = fetchJson('https://api.example/api/current', '数据');
    assert.equal(first, second);
    assert.deepEqual(await first, { ok: true });
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(fetch.mock.calls[0].arguments[1].cache, 'default');

    fetch.mock.mockImplementation(async () => new Response('', {
        status: 429, headers: { 'Retry-After': '30' },
    }));
    await assert.rejects(fetchJson('https://api.example/api/current', '数据'), /30 秒/);
    const calls = fetch.mock.callCount();
    await assert.rejects(fetchJson('https://api.example/api/prediction', '预测'), /请求暂缓/);
    assert.equal(fetch.mock.callCount(), calls);
    t.mock.timers.tick(30_000);

    fetch.mock.mockImplementation(async () => new Response('', { status: 403 }));
    await assert.rejects(fetchJson('https://api.example/api/current', '数据'), /10 秒/);
    t.mock.timers.tick(10_000);
    fetch.mock.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const timed = assert.rejects(fetchJson('https://api.example/api/current', '数据'), /读取超时/);
    t.mock.timers.tick(20_000);
    await timed;
    t.mock.timers.tick(10_000);
    fetch.mock.mockImplementation(async () => new Response('{"ok":true}'));
    assert.deepEqual(await fetchJson('https://api.example/api/current', '数据'), { ok: true });
    await fetchJson('https://site.example/generated/ed.json', 'ED');
    assert.equal(fetch.mock.calls.at(-1).arguments[1].cache, 'no-store');
});
