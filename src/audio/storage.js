const DB_NAME = 'MaiButtonDB';
const DB_VERSION = 3;
const AUDIO_STORE = 'audioCache';
const CDN_STORE = 'cdnSettings';
let database = null;

function openDatabase() {
    if (!database) {
        database = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(AUDIO_STORE)) {
                    db.createObjectStore(AUDIO_STORE, { keyPath: 'path' });
                }
                if (!db.objectStoreNames.contains(CDN_STORE)) {
                    db.createObjectStore(CDN_STORE, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => {
                    db.close();
                    database = null;
                };
                resolve(db);
            };
        }).catch(error => {
            database = null;
            throw error;
        });
    }
    return database;
}

// Resolve after the transaction commits, including writes scheduled by read callbacks.
async function withStore(name, mode, operation) {
    try {
        const db = await openDatabase();
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction(name, mode);
            transaction.onabort = transaction.onerror = () => reject(
                transaction.error || new Error('缓存事务失败')
            );
            const request = operation(transaction.objectStore(name));
            transaction.oncomplete = () => resolve(request?.result);
        });
    } catch (error) {
        console.warn('浏览器缓存操作失败:', error);
        return null;
    }
}

export function getAudioFromCache(path) {
    return withStore(AUDIO_STORE, 'readonly', store => store.get(path));
}

export function saveAudioToCache(path, blob, cdnUrl) {
    return withStore(AUDIO_STORE, 'readwrite', store =>
        store.put({ path, blob, timestamp: Date.now(), cdnUrl })
    );
}

export function cleanupOldCache(cdnUrl) {
    return withStore(AUDIO_STORE, 'readwrite', store => {
        const request = store.openCursor();
        const expiresBefore = Date.now() - 30 * 24 * 60 * 60_000;
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            const item = cursor.value;
            if (item.timestamp < expiresBefore || item.cdnUrl !== cdnUrl) {
                cursor.delete();
            }
            cursor.continue();
        };
        return request;
    });
}

export async function getSelectedCdn() {
    const records = await withStore(CDN_STORE, 'readonly', store => store.getAll());
    return records?.find(cdn => cdn.selected === true) || null;
}

export function saveSelectedCdn(cdn) {
    return withStore(CDN_STORE, 'readwrite', store => {
        // Only the current choice is needed; keep the existing record shape.
        store.clear();
        return store.put({
            id: cdn.id, url: cdn.url, name: cdn.name,
            selected: true, timestamp: Date.now(),
        });
    });
}
