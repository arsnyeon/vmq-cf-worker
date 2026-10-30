export interface SiteSettings {
  title: string;
  description: string;
  footer: string;
  edition: string;
}

const defaults: SiteSettings = {
  title: 'V免签',
  description: '轻量、清晰的支付接入方案',
  footer: '',
  edition: '',
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
