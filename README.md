# 王宝煲音频按钮播放器

在bilibili活动、隶属于北立交桥妖精管理局的虚拟主播王宝煲的音频播放按钮网站，支持音频缓存、循环播放、随机播放等功能。

**项目演示**：[https://wangbaobao.moe/](https://wangbaobao.moe/)

---

## 📁 项目结构

```
bao-button/
├── index.html                    # 主页面模板
├── styles.css                    # 样式文件（可主题化）
├── app.js                        # 主应用程序（ES模块）
├── favicon.jpg                   # 网站图标
├── README.md                     # 说明文档
├── public/                       # 公共资源目录
│   ├── voices/                   # 音频文件目录（存放音频文件）
│   │    ├── aaaaeee.mp3          #音频文件
│   │    └── ...
│   └── logo.png                  #主播logo
└── src/                          # 源码目录
    ├── config/
    │   ├── cdns.js              # CDN配置文件
    │   └── voices.js            # 音频配置文件
    └── locales/
        └── zh.js                # 中文语言包
```

---

## 🚀 快速开始

如果你想制作音频按钮，请访问源项目[yandujun363/audio-button-template](https://github.com/yandujun363/audio-button-template)

### 1. 基础部署

```bash
# 克隆源项目
git clone https://github.com/yandujun363/audio-button-template.git

# 进入目录
cd audio-button-template

# 启动本地服务器（使用Python）
python -m http.server 8000

# 或使用Node.js
npx serve .
```

然后访问：http://localhost:8000

### 2. 修改配置

在 `index.html` 中修改以下标记：

```html
<!-- 修改这些标记 -->
<title>{{title}}</title>                    <!-- 页面标题 -->
<h1>{{title}}</h1>                          <!-- 主标题 -->

<!-- 在页脚部分 -->
<a href="{{href}}" ...>主播空间</a>          <!-- 主播链接 -->
<p class="copyright">{{copyright}}</p>       <!-- 版权信息 -->
```

### 3. 添加音频文件

1. 将音频文件放入 `public/voices/` 目录
2. 在 `src/config/voices.js` 中添加配置：
```javascript
{
    messages: { 
        zh: "按钮显示文本",      // 必填：中文显示
        en: "Button Text",     // 可选：英文显示
        ja: "ボタンテキスト"    // 可选：日文显示
    },
    path: "文件名.mp3",         // 相对于public/voices的路径
    tag: "分类标签"            // 用于分组分类
}
```
3. 如果添加了新的分类标签，在 `src/locales/zh.js` 中定义中文显示名称

### 4. CDN配置（可选）

如果使用CDN托管音频，修改 `src/config/cdns.js`：

```javascript
export const CDN_CONFIGS = [
    {
        id: 'cdn1',
        name: '主CDN',
        url: 'https://your-cdn.com/path/to/audio/',
        description: '主要音频源',
        priority: 1  // 优先级，数字越小优先级越高
    },
    // 更多CDN配置...
];
```

如果不需要CDN，保持空数组 `[]` 即可使用本地文件模式。

---

## ⚙️ 配置文件说明

### 1. 音频配置文件 (`src/config/voices.js`)
- `messages`: 多语言按钮文本
- `path`: 音频文件路径（支持子目录）
- `tag`: 分类标签（需要在语言包中定义）

### 2. 语言配置文件 (`src/locales/zh.js`)
- `tags`: 分类标签的中文显示名称
- 可扩展支持更多语言

### 3. CDN配置文件 (`src/config/cdns.js`)
- `url`: CDN基础URL（必须以 `/` 结尾）
- `priority`: 优先级（1最高）
- 留空则使用本地模式

---

## 🎨 主题定制

通过修改CSS变量快速定制主题：

```css
:root {
    --primary-color: #7aacdd;      /* 主色调 */
    --bg-color: #f5f5f5;           /* 背景色 */
    --card-bg: #ffffff;            /* 卡片背景 */
    --text-primary: #333333;       /* 主要文字颜色 */
    --border-radius: 8px;          /* 圆角大小 */
    /* ... 更多变量 */
}
```

---

## 🔧 功能说明

### 核心功能
- **点击播放**：点击按钮播放对应音频
- **随机播放**：随机选择并播放一个音频
- **停止所有**：停止所有正在播放的音频
- **洗脑循环**：开启后当前音频会循环播放
- **多音频叠加**：支持同时播放多个音频

---

## 📱 响应式设计

- **桌面端**：多列布局，充分利用空间
- **平板端**：自适应单列/双列布局
- **手机端**：优化触摸体验，单列布局

---

## 🛠️ 开发指南

### 添加新功能

1. **扩展语言支持**：
   - 创建新的语言文件如 `en.js`
   - 在主程序中导入并添加到locales对象
   - 添加语言切换界面

2. **添加音频效果**：
   - 在播放逻辑中添加音频处理
   - 考虑添加音量控制、播放速度等

3. **主题系统**：
   - 扩展CSS变量系统
   - 添加主题切换功能

### 性能优化建议
- 音频文件压缩（建议使用MP3格式）
- 图片资源优化
- 懒加载非必要资源
- 使用Service Worker进行缓存

---

## 📊 部署选项

### GitHub Pages
```bash
# 简单部署到GitHub Pages
git add .
git commit -m "部署到GitHub Pages"
git push origin main
```
然后在仓库设置中启用GitHub Pages

### 静态服务器
- Nginx、Apache等传统服务器
- Vercel、Netlify等现代部署平台
- 任何支持静态文件的托管服务


---

## 🔒 隐私与安全

### 数据存储
- 仅使用浏览器本地存储（IndexedDB）
- 不收集用户个人信息
- 所有数据保存在用户本地设备

### 合规性
- 完全客户端运行，无需后端
- 符合GDPR等隐私法规要求
- 不依赖第三方追踪服务

---

## 🤝 贡献指南

欢迎贡献代码！以下是贡献流程：

1. Fork本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

### 贡献方向
- 修复bug
- 添加新功能
- 优化性能
- 改进文档
- 翻译本地化

---

## 📄 许可证

本项目采用 **MIT许可证** - 查看 [LICENSE](LICENSE) 文件了解详情。

**注意**：音频文件版权归原作者所有，仅用于学习和交流目的。请勿将本项目用于商业用途。

---

## 🙏 致谢

- [CaoMeiYouRen/shirakami-haruka-button](https://github.com/CaoMeiYouRen/shirakami-haruka-button) - 源项目灵感来源
- [yandujun363/audio-button-template](https://github.com/yandujun363/audio-button-template) - 源项目
- bilibili-pseudoAD (https://space.bilibili.com/12146170) -ui修改与调试、域名贡献(wangbaobao.moe)
- 所有贡献者和用户
- 开源社区

---

## 🛠 煲情报 ED 与表情包维护

ED 记录在 `public/data/ed.json` 中。每条记录填写 `date`（`YYYY-MM-DD`）、`song` 和 `author`；歌手未知时写“暂无”。新增记录按日期从新到旧排列。页面日期框可输入数字（如 `0924` 或 `20260924`），候选项只列出有 ED 的日期；歌名和歌手共用一个连续关键字搜索框。日期和关键字同时填写时需全部符合。

表情包原图放入 `public/memes/`，再在 `public/data/memes.json` 添加对应的 `file` 和 `title`。支持 `.png`、`.jpg`、`.jpeg`、`.gif`、`.webp`、`.avif` 和 `.svg`；文件名只能是该目录内的单个文件名。缩略图在维护者本机生成，放入 `public/memes/thumbs/`，并在清单的 `thumbnail` 字段填写缩略图文件名。GIF 缩略图取第一帧，原始 GIF 保持动画。仓库仅保存网页前端及静态资源，后端、测试和缩略图生成工具由维护者在本机保管。

访客点击“展开表情包”后才读取清单和缩略图；每次最多增加 24 张。点击缩略图时才读取原图，可切换图片或保存原图。收起时会移除图片元素。

---

## ❓ 常见问题

### Q: 音频加载很慢怎么办？
A: 首次访问会预加载所有音频，后续访问会从缓存加载，速度很快。

### Q: 如何清除浏览器缓存？
A: 浏览器开发者工具 → Application → Storage → Clear site data

### Q: 支持哪些音频格式？
A: 支持所有现代浏览器支持的格式：MP3、WAV、OGG等。

### Q: 如何添加新分类？
A: 在 `voices.js` 中使用新tag，然后在 `zh.js` 中添加对应的翻译。

### Q: 为什么按钮不显示中文？
A: 确保 `zh.js` 中定义了对应的tag翻译，且tag拼写完全一致。

### Q: CDN配置需要注意什么？
A: CDN服务器必须配置CORS（跨域资源共享），否则浏览器会阻止加载。

---

## 📞 支持与反馈

如有问题或建议，请：
1. 查看[GitHub Issues](https://github.com/yandujun363/audio-button-template/issues)
   或[GitHub Issues](https://github.com/Latori12/bao-button/issues)
2. 提交新的Issue
3. 或通过Pull Request贡献代码

---

**快乐玩耍，文明使用！**
