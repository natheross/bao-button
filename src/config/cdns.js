// src/config/cdns.js

/**
 * CDN配置文件说明
 * 
 * ============================================
 * 配置结构与规则
 * ============================================
 * 
 * 1. 配置文件是一个数组，每个元素代表一个音频源
 * 2. 系统会根据以下规则选择音频源：
 *    - 如果数组为空：使用本地模式，从 generated/voices/ 加载音频
 *    - 如果只有一个配置项：自动使用该CDN（单CDN模式）
 *    - 如果有多个配置项：显示选择界面让用户选择（多CDN模式）
 * 
 * 3. 每个CDN配置对象包含以下属性：
 *    {
 *      id: string,           // 唯一标识符（必填）
 *      name: string,         // 显示名称（必填）
 *      url: string,          // CDN基础URL（必填）
 *                              // 注意：必须以斜杠 / 结尾
 *      description: string,  // 描述信息（可选）
 *      priority: number      // 优先级，数字越小优先级越高（必填）
 *    }
 * 
 * ============================================
 * 重要：CORS（跨域资源共享）配置
 * ============================================
 * 
 * 所有CDN服务器必须正确配置CORS，否则浏览器会阻止音频加载。
 * 需要在CDN服务器上添加以下响应头：
 * 
 * 1. Nginx配置示例：
 *    location / {
 *        add_header 'Access-Control-Allow-Origin' '*';
 *        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS';
 *        add_header 'Access-Control-Allow-Headers' 'Range, Accept-Encoding, Origin';
 *        add_header 'Access-Control-Expose-Headers' 'Content-Length, Content-Range';
 *    }
 * 
 * 2. Cloudflare配置：
 *    在Workers或页面规则中添加CORS头，或在WAF规则中允许跨域
 * 
 * 3. 确保服务器响应OPTIONS预检请求
 * 
 * ============================================
 * 音频文件组织要求
 * ============================================
 * 
 * 1. CDN上的文件结构必须与 voices.js 中的 path 字段匹配
 *    例如：如果 path 为 "haruka/01.mp3"
 *          CDN URL 应为 "https://cdn.example.com/voices/haruka/01.mp3"
 * 
 * 2. 建议保持以下目录结构：
 *    CDN根目录/
 *    ├── haruka/
 *    │   ├── 01.mp3
 *    │   └── 02.mp3
 *    ├── nene/
 *    │   ├── 01.mp3
 *    │   └── 02.mp3
 *    └── ...其他角色
 * 
 * ============================================
 * 缓存策略
 * ============================================
 * 
 * 1. 系统会自动缓存音频到 IndexedDB
 * 2. 缓存会记录CDN来源，切换CDN时自动清理旧缓存
 * 3. 缓存有效期：30天
 * 4. 用户可以勾选"记住选择"来保存CDN偏好
 * 
 * ============================================
 * 回退机制
 * ============================================
 * 
 * 1. 按优先级顺序尝试所有CDN
 * 2. 如果所有CDN都失败，尝试本地文件
 * 3. 本地文件由 内容/音频/ 自动生成到 generated/voices/
 * 
 * ============================================
 * 配置示例
 * ============================================
 */

export const CDN_CONFIGS = [
    // 示例1：Cloudflare CDN（主CDN）
    // {
    //     id: 'cdn1',
    //     name: '主CDN(Cloudflare)',
    //     url: 'https://cdn.yangdujun.top/auido/3546775765912341/',
    //     description: '主要CDN源，通过Cloudflare加载',
    //     priority: 1  // 最高优先级
    // },
    
    // 示例2：自建NAS CDN
    // {
    //     id: 'cdn3',
    //     name: 'NASCDN',
    //     url: 'https://naslink.yangdujun.top/api/public/dl/2XO4OUh3/3546775765912341/',
    //     description: '用NAS实现的CDN，容易炸，但是速度会快点',
    //     priority: 3  // 低优先级
    // },
    
    // 示例3：本地模式配置
    // {
    //     id: 'local',
    //     name: '本地音频',
    //     url: '',  // 关键：留空表示本地模式
    //     description: '从项目本地目录加载音频',
    //     priority: 999  // 最低优先级，作为回退方案
    // }
];

/**
 * ============================================
 * 调试与测试
 * ============================================
 * 
 * 1. 测试CDN是否正常：
 *    直接在浏览器中访问：https://cdn.example.com/voices/haruka/01.mp3
 *    检查是否能正常播放，以及响应头是否包含CORS头
 * 
 * 2. 测试本地模式：
 *    将CDN_CONFIGS设为空数组 [] 或注释掉所有配置
 *    确保 generated/voices/ 目录下有对应的音频文件
 * 
 * 3. 缓存清理：
 *    在浏览器开发者工具中 -> Application -> IndexedDB -> MaiButtonDB
 *    可以手动清理缓存数据
 * 
 * ============================================
 * 注意事项
 * ============================================
 * 
 * 1. 确保所有CDN上的音频文件名和路径完全一致
 * 2. CDN URL必须以斜杠 / 结尾，否则路径拼接会出错
 * 3. 生产环境建议限制CORS来源，避免使用通配符 "*"
 * 4. 如果使用HTTPS，确保CDN证书有效
 * 5. 大文件建议启用Range请求支持
 */