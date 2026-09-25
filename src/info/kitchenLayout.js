const IMAGE_WIDTH = 1671;
const IMAGE_HEIGHT = 941;
// Safe area inside the cutting board. The back edge is narrower than the front.
const BOARD = { left: 530, top: 510, width: 550, height: 160 };
const PAN = { left: 1230, top: 390, width: 410, height: 220 };
// 锅中食物图：[水平中心, 垂直中心, 宽度, 高度]，四项均可单独调整。
const DISH_PLACEMENTS = {
    '单蛋.png': [1430, 515, 180, 90],
    '单番茄.png': [1430, 510, 300, 190],
    '少番茄少蛋.png': [1425, 518, 260, 135],
    '少番茄中蛋.png': [1432, 500, 321, 148],
    '少番茄多蛋.png': [1429, 487, 370, 180],
    '多番茄少蛋.png': [1432, 492, 364, 168],
    '多番茄中蛋.png': [1432, 487, 365, 180],
    '多番茄多蛋.png': [1435, 486, 372, 174],
};
// 葱花图层：[水平中心, 垂直中心, 宽度, 高度]，坐标基于 1671×941 的背景原图。
const SCALLION_PLACEMENTS = {
    empty: [1435, 510, 255, 170],
    '单蛋.png': [1430, 515, 180, 80],
    '单番茄.png': [1430, 510, 180, 80],
    '少番茄少蛋.png': [1430, 510, 210, 100],
    '少番茄中蛋.png': [1420, 495, 250, 150],
    '少番茄多蛋.png': [1430, 485, 260, 150],
    '多番茄少蛋.png': [1430, 485, 290, 150],
    '多番茄中蛋.png': [1425, 475, 290, 160],
    '多番茄多蛋.png': [1427, 470, 300, 180],
};
const TOP_EDGE = { left: 25, right: 525 };
const BOTTOM_EDGE = { left: 0, right: 550 };

function backgroundRect(rect, frameWidth, frameHeight, positionX, positionY) {
    const scale = Math.max(frameWidth / IMAGE_WIDTH, frameHeight / IMAGE_HEIGHT);
    return {
        left: (frameWidth - IMAGE_WIDTH * scale) * positionX + rect.left * scale,
        top: (frameHeight - IMAGE_HEIGHT * scale) * positionY + rect.top * scale,
        width: rect.width * scale,
        height: rect.height * scale,
    };
}

export function boardRect(frameWidth, frameHeight, positionX = 0.5, positionY = 0.5) {
    return backgroundRect(BOARD, frameWidth, frameHeight, positionX, positionY);
}

export function panRect(frameWidth, frameHeight, positionX = 0.5, positionY = 0.5) {
    return backgroundRect(PAN, frameWidth, frameHeight, positionX, positionY);
}

function placedRect(placement, frameWidth, frameHeight, positionX, positionY) {
    const [centerX, centerY, width, height] = placement;
    return backgroundRect({
        left: centerX - width / 2,
        top: centerY - height / 2,
        width,
        height,
    }, frameWidth, frameHeight, positionX, positionY);
}

export function dishRect(dishName, frameWidth, frameHeight, positionX = 0.5, positionY = 0.5) {
    const placement = DISH_PLACEMENTS[dishName];
    return placement
        ? placedRect(placement, frameWidth, frameHeight, positionX, positionY)
        : panRect(frameWidth, frameHeight, positionX, positionY);
}

export function scallionRect(dishName, frameWidth, frameHeight, positionX = 0.5, positionY = 0.5) {
    return placedRect(SCALLION_PLACEMENTS[dishName] || SCALLION_PLACEMENTS.empty,
        frameWidth, frameHeight, positionX, positionY);
}

export function ingredientPosition(index, count, kind) {
    const row = Math.floor(index / 10);
    const rows = Math.ceil(count / 10);
    const tomato = kind === 'tomato';
    const top = (tomato ? 64 : 0) + (rows === 1
        ? (tomato ? 6 : 6)
        : row * (tomato ? 8 : 16) / (rows - 1));
    const depth = (top + (tomato ? 30 : 29)) / BOARD.height;
    const width = (tomato ? 70 + 3 * depth : 58 + 2 * depth) * 1.3;
    const topDepth = top / BOARD.height;
    const leftEdge = TOP_EDGE.left + (BOTTOM_EDGE.left - TOP_EDGE.left) * topDepth;
    const rightEdge = TOP_EDGE.right + (BOTTOM_EDGE.right - TOP_EDGE.right) * topDepth;
    const step = tomato ? 48 : 39;
    const left = Math.min(leftEdge + (tomato ? 6 : 14) + (index % 10) * step,
        rightEdge - width);
    return {
        left: `${left / BOARD.width * 100}%`,
        top: `${top / BOARD.height * 100}%`,
        width: `${width / BOARD.width * 100}%`,
        zIndex: row + 1,
    };
}
