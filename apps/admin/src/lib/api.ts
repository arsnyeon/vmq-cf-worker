/**
 * API 客户端。
 *
 * 只做三件事：拼路径、带上 cookie（同源自动带）、把 { code,msg,data,count } 解包。
 * 401 统一抛 UnauthorizedError，由路由守卫捕获后跳登录页。
 */
const BASE = '/api/admin';

export interface ApiEnvelope<T> {
  code: 0 | 1;
  msg: string;
  count?: number;
  data?: T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor() {
    super('未登录', 401);
    this.name = 'UnauthorizedError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<{ data: T; count?: number; msg: string }> {
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    headers: {},
  };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  const res = await fetch(BASE + path, init);
  if (res.status === 401) throw new UnauthorizedError();

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(`响应不是 JSON（HTTP ${res.status}）`, res.status);
  }

  if (!json) throw new ApiError('响应为空', res.status);

  // code=1 是成功；列表接口成功时 code=0 但一定带 count
  if (json.code === 1) return { data: json.data as T, count: json.count, msg: json.msg ?? '' };
  if (typeof json.count === 'number') {
    return { data: json.data as T, count: json.count, msg: '' };
  }
  throw new ApiError(json.msg || '请求失败', 0);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

/**
 * 上传一张图片，返回可直接访问的地址（`/upload/<hash>`）。
 *
 * 后端存在 D1 的 uploads 表里（base64），限额 1.4MB / png,jpg,gif,webp。
 * 前端的体积预检只是提前给个提示，真正的限额以后端为准。
 */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
  });
  const json = (await res.json()) as { code: number; msg: string; data?: { url: string } };
  if (json.code !== 1 || !json.data?.url) throw new Error(json.msg || '上传失败');
  return json.data.url;
}


/* ============================ 类型 ============================ */

export interface Me {
  id: number;
  username: string;
  role: number;
  /** 头像地址（/upload/xxx）；空串表示没设置 */
  head_img?: string;
}

export interface ChartData {
  /** 与 income1/order1 等一一对应的日期（YYYY-MM-DD，上海时区） */
  labels: string[];
  income1: number[];
  income2: number[];
  order1: number[];
  order2: number[];
}

export interface Stats {
  income1: string;
  income2: string;
  order1: number;
  order2: number;
  chartData: ChartData;
  online: boolean;
  pending: number;
  paid: number;
  notifyFailed: number;
  expired: number;
}

/** 概览页「系统信息」表格的数据 */
export interface SystemInfo {
  edition: string;
  siteAddress: string;
  runPlatform: string;
  database: string;
  monitor: string;
  monitorOnline: boolean;
  staticAssets: string;
  uploadLimit: string;
  notifyJudge: string;
  notifyRetry: string;
  quota: string;
}
