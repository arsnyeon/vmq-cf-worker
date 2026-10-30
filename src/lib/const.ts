/**
 * 常量。
 *
 * 默认管理员口令单独放这里，测试直接 import，
 * 避免"代码里改了、文档/测试没跟上"这类低级错误。
 */

/** 首次部署自动创建的管理员口令，登录后请立刻修改 */
export const DEFAULT_ADMIN_USER = 'admin';
export const DEFAULT_ADMIN_PW = '123456';

/** 后台会话有效期（秒） */
export const ADMIN_SESSION_TTL = 60 * 60 * 12;

/**
 * 上传大小上限。
 *
 * ⚠️ 为什么是 1.4MB 而不是 2MB：图片以 **base64 文本**存进 D1 的 `uploads` 表，
 * 而 D1 单个字符串/BLOB 的上限是 **2,000,000 字节（2MB）**，
 * base64 会膨胀 4/3 —— 2MB 的文件编码后是 2.67MB，必然超限（SQLITE_TOOBIG）。
 * 反推可用原始大小：2,000,000 ÷ 4 × 3 ≈ 1,500,000 字节，取 1.4MB 留一点余量。
 * 如果以后换 R2 存二进制，这个值可以放开。
 */
export const MAX_UPLOAD_BYTES = Math.floor(1.4 * 1024 * 1024);

/** 展示用文案，跟着上面的常量走，避免两处不一致 */
export const MAX_UPLOAD_LABEL = `${(MAX_UPLOAD_BYTES / 1048576).toFixed(1)}MB`;

/** 上传允许的 MIME（与前端 accept 保持一致） */
export const UPLOAD_MIME_LABEL = 'png/jpg/gif/webp';

/** D1 单个字符串/BLOB 的硬上限（官方限制），超过会 SQLITE_TOOBIG 或被截断 */
export const MAX_D1_VALUE_BYTES = 2_000_000;

/**
 * 随 Worker 发布的静态资源规模（后台首页展示用）。
 * ⚠️ assets 目录有增删时手动更新这一行：`du -sh public && find public -type f | wc -l`
 */
export const STATIC_ASSETS_LABEL = '53 个文件 / 1.3M';

/** 默认头像：留空表示不设置（SPA 的资料页是 URL 输入框，不展示图片） */
export const DEFAULT_HEAD_IMG = '';
