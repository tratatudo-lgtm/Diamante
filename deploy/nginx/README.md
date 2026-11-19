# VPS deployment: DuckDNS virtual hosts

The public homepage and both application portals are served by the same Diamante OS
backend on 127.0.0.1:3000. The app selects the portal from the Host header.

- diamantedouro.duckdns.org: institutional homepage
- loja-diamantedouro.duckdns.org: employee/store portal
- admin-diamantedouro.duckdns.org: administrator portal
- evolution-diamantedouro.duckdns.org: Evolution API/Manager only, protected by HTTP Basic Auth

## Nginx files

- Install `diamante-os.conf` as `/etc/nginx/sites-enabled/diamante-os`.
- Replace the old `evolution-manager` virtual-host file with `evolution-manager.conf`.
  This intentionally removes the admin hostname from Evolution Manager so the app can own it.
- Keep `/etc/nginx/.htpasswd-evolution-manager` and the existing certificate directories.
- Do not enable the old `sites-available/diamante-os` file: it references the removed
  `/opt/diamante-os/dist` directory and contains duplicate Evolution locations.

## Validation and activation

Run as root, after the Diamante OS service is listening on 127.0.0.1:3000:

```sh
nginx -t
systemctl reload nginx
```

Then check the four HTTPS hostnames. The three app domains should reach the app.
The Evolution hostname should continue to request HTTP Basic Auth.

## Backend environment

- `PORT=3000`
- `NODE_ENV=production`
- `FRONTEND_URL=https://diamantedouro.duckdns.org`
- `APP_URL=https://diamantedouro.duckdns.org`
- `EVOLUTION_API_URL=http://127.0.0.1:9090` when the backend runs on the host.
  If containerized, attach only the Diamante app container to the existing
  `evolution-docker_evolution-net` network and use `http://evolution-api:8080`.
- Set real `EVOLUTION_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `JWT_SECRET` and `OTP_HMAC_SECRET` in a root-owned environment file (0600).
  Never commit real values.

Do not restart or recreate Evolution API or its PostgreSQL container.
