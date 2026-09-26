import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { preloadInBatches } from '../src/audio/preload.js';
import * as storage from '../src/audio/storage.js';

test('preloading respects the batch limit and counts failures once', async context => {
    context.mock.method(console, 'warn', () => {});
    let active = 0;
    let peak = 0;
    let settled = 0;
    const loaded = [];
    const items = Array.from({ length: 12 }, (_, index) => ({ path: `${index}.mp3` }));
    await preloadInBatches(items, async item => {
        active++;
        peak = Math.max(peak, active);
        await nextTurn();
        active--;
        loaded.push(item.path);
        if (item.path === '2.mp3') throw new Error('test download failure');
    }, () => settled++);
    assert.equal(peak, 5);
    assert.equal(settled, items.length);
    assert.deepEqual(loaded, items.map(item => item.path));
    await assert.rejects(preloadInBatches([], () => {}, () => {}, 0), /batch size/);
});

test('preloading stops scheduling files after cancellation', async () => {
    const controller = new AbortController();
    const started = [];
    let settled = 0;
    await preloadInBatches(Array.from({ length: 10 }, (_, index) => ({ path: `${index}.mp3` })),
        async item => {
            started.push(item.path);
            controller.abort();
        }, () => settled++, 5, controller.signal);
    assert.equal(started.length, 1);
    assert.equal(settled, 1);
});

test('storage reuses its connection and awaits transaction completion or abort', async context => {
    context.mock.method(console, 'warn', () => {});
    let opened = 0;
    const pending = [];
    const writes = [];
    const stored = { path: 'one.mp3', blob: 'test blob' };
    const db = {
        close() {},
        transaction(name, mode) {
            const transaction = {
                error: new Error('test abort'),
                objectStore: () => ({
                    get: () => ({ result: stored }),
                    put: value => { writes.push(value); return { result: value.path }; },
                }),
            };
            pending.push({ transaction, name, mode });
            return transaction;
        },
    };
    const original = globalThis.indexedDB;
    globalThis.indexedDB = {
        open() {
            opened++;
            const request = { result: db };
            queueMicrotask(() => request.onsuccess());
            return request;
        },
    };
    try {
        let completed = false;
        const read = storage.getAudioFromCache('one.mp3').then(value => {
            completed = true;
            return value;
        });
        await nextTurn();
        assert.equal(completed, false);
        assert.equal(pending[0].name, 'audioCache');
        pending[0].transaction.oncomplete();
        assert.equal(await read, stored);

        const write = storage.saveAudioToCache('two.mp3', 'new blob', '/voices/');
        await nextTurn();
        assert.equal(opened, 1);
        assert.equal(pending[1].mode, 'readwrite');
        assert.equal(writes[0].cdnUrl, '/voices/');
        pending[1].transaction.onabort();
        assert.equal(await write, null);
    } finally {
        db.onversionchange?.();
        if (original === undefined) delete globalThis.indexedDB;
        else globalThis.indexedDB = original;
    }
});
