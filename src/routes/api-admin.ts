/**
 * 后台 JSON API（SPA 用）。
 *
 * 与旧后台的关系：**同一套 service，不同的出口**。
 * 旧后台（/别名/system.xxx/index）返回 HTML 或 layui 表格 JSON；
 * 这里对外只给干净的 REST 形状，路径固定为 /api/admin/*，不带别名。
 *
 * 约定：
 *   · 鉴权靠会话 cookie（与旧后台同一个 cookie，同域天然共享）
 *   · 成功 200 + { code: 1, msg, data? }
 *   · 业务失败 200 + { code: 0, msg }（前端看 code，不看 HTTP 状态）
 *   · 未登录 401 + { code: 0, msg: '未登录' }（前端据此跳登录页）
 *   · 列表 200 + { code: 0, msg: '', count, data } —— 沿用旧版表格契约
 */
import type { Env } from '../lib/db';
import { clearCookie, readSession } from '../lib/auth';
import { json, externalHost, externalProto, readParams } from '../lib/util';
import { okData, reply, replyFail } from '../http/respond';
import { handleCaptcha, handleLoginPost } from './auth';

// 领域服务
import { listOrders, removeOrders, setBd } from '../modules/orders/order.service';
import {
  listPassages,
  removePassages,
  savePassage,
  setPassageStatus,
} from '../modules/passages/passage.service';
import { listLogs, removeLogs } from '../modules/content/content.service';
import {
  changePassword,
  listAdmins,
  removeAdmins,
  saveAdmin,
  saveConfig,
  saveEpayConfig,
  saveProfile,
  setAdminStatus,
} from '../modules/system/system.service';
import { allConfig, profileOf } from '../modules/system/system.repository';
import { dashboard, ONLINE_WINDOW } from '../modules/stats/stats.service';
import * as statsRepo from '../modules/stats/stats.repository';
import { saveUpload } from '../modules/uploads/upload.service';
import { notifyJudgeLabel } from '../modules/shared/labels';
import { siteHost } from '../lib/page';
import { fmtTime } from '../lib/page';
import { MAX_UPLOAD_LABEL, STATIC_ASSETS_LABEL, UPLOAD_MIME_LABEL } from '../lib/const';

/** 会话里能拿到的最小身份 */
interface Session {
  u: string;
  id?: number;
}

/** 这些配置项不回传给前端，只告诉它「配过没」 */
const SECRET_CONFIG_KEYS = [
  'key',
  'app_key', // 与 key 等价（db.ts 的 appSecret 优先读它），必须一起过滤
  'merchant_key',
  'epaykey_ali',
  'admin_secret',
  'cron_key',
];

function unauthorized(): Response {
  return json({ code: 0, msg: '未登录' }, 401);
}

function notFound(): Response {
  return json({ code: 0, msg: '接口不存在' }, 404);
}

/** 退出登录：清 cookie，返回 JSON（旧后台是 302，这里不能跳） */
function logoutJson(): Response {
  return new Response(JSON.stringify({ code: 1, msg: '已退出' }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': clearCookie(),
      'cache-control': 'no-store',
    },
  });
}

/**
 * 入口。sub 是 `/api/admin` 之后的路径（含前导斜杠）。
 */
export async function handleAdminApi(req: Request, env: Env, sub: string): Promise<Response> {
  const path = sub.replace(/\/+$/, '') || '/';
  const seg = path.split('/').filter(Boolean);
  const method = req.method;

  /* ---------- 公开接口（不读 body，登录要自己读） ---------- */
  if ((path === '/login' || path === '/auth/login') && method === 'POST') {
    return handleLoginPost(req, env);
  }
  if (path === '/captcha') return handleCaptcha(env);

  const session = (await readSession(req, env)) as Session | null;

  /* ---------- 上传：必须在 readParams 之前，multipart 只能读一次 ---------- */
  if (path === '/upload' && method === 'POST') {
    if (!session) return unauthorized();
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return replyFail('请用表单上传');
    }
    const file = form.get('file');
    if (!(file instanceof File)) return replyFail('没有收到文件');
    return reply(await saveUpload(env, file));
  }

  /* ---------- 其余接口都要登录 ---------- */
  const p = await readParams(req);
  if (!session) return unauthorized();
  const uid = session.id ?? 1;

  // 兼容 DELETE /xxx?ids=1,2 与 body { ids: [1,2] }
  if (p['ids'] && !p['id']) p['id'] = p['ids'];

  /** 取路径里的数字 id：/passages/12 → 12 */
  const pathId = (i = 1): number => Number(seg[i] ?? 0) || 0;

  /* ============================ 会话 / 个人 ============================ */

  if (path === '/me') {
    return reply(okData({ id: uid, username: session.u, role: 1 }));
  }
  if (path === '/logout' && method === 'POST') return logoutJson();

  if (path === '/profile') {
    if (method === 'PUT' || method === 'POST') return reply(await saveProfile(env, p, uid));
    const row = await profileOf(env.DB, uid);
    return row ? reply(okData(row)) : replyFail('账号不存在');
  }
  if (path === '/profile/password' && (method === 'PUT' || method === 'POST')) {
    return reply(await changePassword(env, p, uid));
  }

  /* ============================ 看板 ============================ */

  if (path === '/stats' && method === 'GET') return reply(await dashboard(env));

  /**
   * 系统信息：给「概览」页的两块说明表格用。
   * 原来这些是服务端渲染进 welcome.html 的，现在改成接口，SPA 自己排版。
   */
  if (path === '/system-info' && method === 'GET') {
    const cfg = await allConfig(env.DB);
    const heart = await statsRepo.lastHeart(env.DB);
    const ts = Math.floor(Date.now() / 1000);
    const age = heart ? ts - heart : -1;
    const online = age >= 0 && age <= ONLINE_WINDOW;

    return reply(
      okData({
        edition: `${cfg['edition'] ?? 'v1.0.0'}（Cloudflare 版）`,
        siteAddress: siteHost(cfg, req),
        runPlatform: 'Cloudflare Workers · workerd',
        database: 'D1 (SQLite) · APAC',
        monitor:
          age < 0
            ? '未连接'
            : online
              ? `在线 · ${age} 秒前心跳`
              : `离线 · 最后心跳 ${fmtTime(heart)}`,
        monitorOnline: online,
        staticAssets: STATIC_ASSETS_LABEL,
        uploadLimit: `${MAX_UPLOAD_LABEL} · ${UPLOAD_MIME_LABEL}`,
        notifyJudge: notifyJudgeLabel(cfg['notify_success_body'] ?? 'success'),
        notifyRetry: '8 次 · 跨度约 20 小时',
        quota: '以 Cloudflare 控制台为准',
      })
    );
  }

  /* ============================ 订单 ============================ */

  if (path === '/orders') {
    if (method === 'GET') return reply(await listOrders(env, p));
    if (method === 'DELETE') return reply(await removeOrders(env, p));
    return notFound();
  }
  if (seg[0] === 'orders' && seg[2] === 'notify' && method === 'POST') {
    p['id'] = String(pathId());
    return reply(await setBd(env, p));
  }

  /* ============================ 通道 ============================ */

  if (path === '/passages') {
    if (method === 'GET') {
      // 传对外 origin：反代场景下 Host 已是 Worker 域名，真实域名在 X-Forwarded-Host
      const origin = `${externalProto(req)}://${externalHost(req)}`;
      return reply(await listPassages(env, p, origin));
    }
    if (method === 'POST') return reply(await savePassage(env, p, 0));
    if (method === 'DELETE') return reply(await removePassages(env, p));
    return notFound();
  }
  if (seg[0] === 'passages' && seg.length >= 2) {
    const id = pathId();
    if (seg[2] === 'status' && method === 'PATCH') {
      p['id'] = String(id);
      return reply(await setPassageStatus(env, p));
    }
    if (!seg[2] && (method === 'PUT' || method === 'PATCH')) {
      return reply(await savePassage(env, p, id));
    }
  }

  /* ============================ 日志 ============================ */

  if (path === '/logs') {
    if (method === 'GET') return reply(await listLogs(env, p));
    if (method === 'DELETE') {
      // 支持 ?days=7 清理 N 天前；只传 id 则按行删除
      if (p['days']) p['time'] = p['days'];
      return reply(await removeLogs(env, p));
    }
    return notFound();
  }

  /* ============================ 管理员 ============================ */

  if (path === '/admins') {
    if (method === 'GET') return reply(await listAdmins(env, p));
    if (method === 'POST') return reply(await saveAdmin(env, p, 0));
    if (method === 'DELETE') return reply(await removeAdmins(env, p, uid));
    return notFound();
  }
  if (seg[0] === 'admins' && seg.length >= 2) {
    const id = pathId();
    if (seg[2] === 'status' && method === 'PATCH') {
      p['id'] = String(id);
      return reply(await setAdminStatus(env, p));
    }
    if (!seg[2] && (method === 'PUT' || method === 'PATCH')) {
      return reply(await saveAdmin(env, p, id));
    }
  }

  /* ============================ 配置 ============================ */

  if (path === '/config') {
    if (method === 'GET') {
      const all = await allConfig(env.DB);
      const data: Record<string, string> = { ...all };
      const secretSet: Record<string, boolean> = {};
      for (const k of SECRET_CONFIG_KEYS) {
        secretSet[k] = !!all[k];
        delete data[k]; // 密钥不回传，只告诉前端「配过没」
      }
      return reply(okData({ config: data, secretSet }));
    }
    if (method === 'PUT' || method === 'POST') return reply(await saveConfig(env, p));
    return notFound();
  }
  if (path === '/config/pay' && (method === 'PUT' || method === 'POST')) {
    return reply(await saveEpayConfig(env, p));
  }

  return notFound();
}
