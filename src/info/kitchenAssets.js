export function fishbowlFilename(coinCount) {
    if (!Number.isSafeInteger(coinCount) || coinCount < 0) return null;
    if (coinCount === 0) return '空鱼缸.png';
    if (coinCount <= 10) return '少硬币鱼缸.png';
    if (coinCount <= 30) return '中硬币鱼缸.png';
    return '多硬币鱼缸.png';
}

export function dishFilename(eggCount, tomatoCount) {
    if (![eggCount, tomatoCount].every(value => Number.isSafeInteger(value) && value >= 0)) return null;
    if (eggCount === 0 && tomatoCount === 0) return null;
    if (eggCount === 0) return '单番茄.png';
    if (tomatoCount === 0) return '单蛋.png';
    const eggLevel = eggCount <= 4 ? '少' : eggCount <= 10 ? '中' : '多';
    const tomatoLevel = tomatoCount <= 3 ? '少' : '多';
    return `${tomatoLevel}番茄${eggLevel}蛋.png`;
}
