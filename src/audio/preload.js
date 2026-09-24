// Keep a fixed number of active downloads; one slow file does not hold up a batch.
export async function preloadInBatches(items, load, onSettled, batchSize = 5, signal) {
    if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('Invalid batch size');
    let next = 0;
    const worker = async () => {
        while (next < items.length && !signal?.aborted) {
            const item = items[next++];
            try {
                await load(item, signal);
            } catch (error) {
                if (!signal?.aborted) console.warn(`音频 ${item.path} 预加载失败:`, error);
            } finally {
                onSettled();
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(batchSize, items.length) }, worker));
}
