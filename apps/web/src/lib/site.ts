export interface SiteSettings {
  title: string;
  description: string;
  footer: string;
  edition: string;
  /** 静态资源根地址（config.resource_url），空串 = 用相对路径 */
  resourceUrl?: string;
}

const defaults: SiteSettings = {
  title: 'V免签',
  description: '轻量、清晰的支付接入方案',
  footer: '',
  edition: '',
  resourceUrl: '',
};

export function getSiteSettings(): SiteSettings {
  const raw = document.getElementById('site-config')?.textContent;
  if (!raw) return defaults;
  try {
    return { ...defaults, ...JSON.parse(raw) } as SiteSettings;
  } catch {
    return defaults;
  }
}

/**
 * 拼静态资源地址：配了 resourceUrl 就拼成绝对地址，否则保持相对路径。
 * 用于 JS 里硬编码的图片路径（demo 页图标），让它们和 HTML 里的 JS/CSS 一样走 CDN。
 */
export function asset(path: string): string {
  const base = (getSiteSettings().resourceUrl ?? '').trim().replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}
