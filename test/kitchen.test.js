import test from 'node:test';
import assert from 'node:assert/strict';
import { dishFilename, fishbowlFilename } from '../src/info/kitchenAssets.js';
import { boardRect, dishRect, ingredientPosition, panRect, scallionRect } from '../src/info/kitchenLayout.js';

test('fishbowl changes at the agreed coin boundaries', () => {
    for (const [count, file] of [
        [0, '空鱼缸.png'],
        [1, '少硬币鱼缸.png'],
        [10, '少硬币鱼缸.png'],
        [11, '中硬币鱼缸.png'],
        [30, '中硬币鱼缸.png'],
        [31, '多硬币鱼缸.png'],
    ]) {
        assert.equal(fishbowlFilename(count), file);
    }
    assert.equal(fishbowlFilename(null), null);
    assert.equal(fishbowlFilename(-1), null);
});

test('wok dish follows single-ingredient and quantity boundaries', () => {
    for (const [eggs, tomatoes, filename] of [
        [0, 0, null], [1, 0, '单蛋.png'], [0, 1, '单番茄.png'],
        [1, 1, '少番茄少蛋.png'], [4, 3, '少番茄少蛋.png'],
        [5, 3, '少番茄中蛋.png'], [10, 4, '多番茄中蛋.png'],
        [11, 3, '少番茄多蛋.png'], [4, 4, '多番茄少蛋.png'],
        [11, 4, '多番茄多蛋.png'],
    ]) {
        assert.equal(dishFilename(eggs, tomatoes), filename);
    }
    assert.equal(dishFilename(-1, 1), null);
    assert.equal(dishFilename(NaN, 1), null);
    assert.deepEqual(panRect(1671, 941), {
        left: 1230, top: 390, width: 410, height: 220,
    });
    for (const filename of [
        '单蛋.png', '单番茄.png', '少番茄少蛋.png', '少番茄中蛋.png',
        '少番茄多蛋.png', '多番茄少蛋.png', '多番茄中蛋.png', '多番茄多蛋.png',
    ]) {
        for (const rect of [dishRect(filename, 1671, 941), scallionRect(filename, 1671, 941)]) {
            assert.ok(Object.values(rect).every(Number.isFinite));
            assert.ok(rect.width > 0 && rect.height > 0);
        }
    }
});

test('ingredients wrap after ten and board follows the covered background', () => {
    assert.equal(ingredientPosition(9, 11, 'egg').zIndex, 1);
    assert.equal(ingredientPosition(10, 11, 'egg').zIndex, 2);
    assert.ok(parseFloat(ingredientPosition(10, 11, 'egg').left) <
        parseFloat(ingredientPosition(9, 11, 'egg').left));
    assert.deepEqual(boardRect(1671, 941), {
        left: 530, top: 510, width: 550, height: 160,
    });
    assert.equal(boardRect(800, 941).left, 94.5);
    assert.equal(ingredientPosition(20, 30, 'egg').top, '10%');
    assert.ok(parseFloat(ingredientPosition(10, 31, 'egg').top) <
        parseFloat(ingredientPosition(10, 30, 'egg').top));
    assert.ok(parseFloat(ingredientPosition(10, 11, 'tomato').top) < 62);
    for (const [count, kind, heightRatio] of [
        [30, 'egg', 1], [31, 'egg', 1],
        [10, 'tomato', 1160 / 1355], [11, 'tomato', 1160 / 1355],
    ]) {
        for (let index = 0; index < count; index++) {
            const position = ingredientPosition(index, count, kind);
            const left = parseFloat(position.left);
            const top = parseFloat(position.top);
            const width = parseFloat(position.width);
            assert.ok(left >= 0 && left + width <= 100);
            assert.ok(top >= 0 && top + width * 550 / 160 * heightRatio <= 100);
        }
    }
    assert.ok(parseFloat(ingredientPosition(0, 10, 'tomato').width) >
        parseFloat(ingredientPosition(0, 30, 'egg').width));
    assert.ok(parseFloat(ingredientPosition(9, 10, 'egg').left) <
        parseFloat(ingredientPosition(9, 10, 'tomato').left));
});
