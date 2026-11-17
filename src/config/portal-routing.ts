export type PortalMode = 'public' | 'store' | 'admin' | 'app';

export const PORTAL_URLS = {
  public: 'https://diamantedouro.duckdns.org',
  store: 'https://loja-diamantedouro.duckdns.org',
  admin: 'https://admin-diamantedouro.duckdns.org',
} as const;

export function getPortalMode(hostname: string): PortalMode {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');

  if (host === 'diamantedouro.duckdns.org') return 'public';
  if (host === 'loja-diamantedouro.duckdns.org') return 'store';
  if (host === 'admin-diamantedouro.duckdns.org') return 'admin';

  return 'app';
}

export function isRoleAllowedOnPortal(
  portal: PortalMode,
  role: string | null | undefined,
): boolean {
  if (portal === 'admin') {
    return typeof role === 'string' && role.trim().toLowerCase() === 'admin';
  }

  if (portal === 'store') {
    return typeof role === 'string' && role.trim().length > 0
      && role.trim().toLowerCase() !== 'admin';
  }

  return true;
}

export function getPortalUrlForRole(role: string | null | undefined): string {
  return typeof role === 'string' && role.trim().toLowerCase() === 'admin'
    ? PORTAL_URLS.admin
    : PORTAL_URLS.store;
}
