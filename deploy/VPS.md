# Diamante OS V2 — VPS deployment

## Runtime layout

- Diamante OS container: `diamante-os`, published only on host loopback `127.0.0.1:3000`.
- Existing Evolution API: reused by DNS name `evolution-api:8080` on the already-existing Docker network `evolution-docker_evolution-net`.
- Existing Evolution API and PostgreSQL containers are not recreated or modified.
- Supabase remains Supabase Cloud.

## Prepare the VPS

Clone the approved GitHub branch into a new, empty application directory. Never clone into or overwrite the old root-owned `/opt/diamante-rebuild` tree.

Create a root-owned `.env` file with mode `0600`, based on `.env.example`. Required values:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` (unique random secret, at least 32 characters)
- `OTP_HMAC_SECRET` (different unique random secret, at least 32 characters)
- `EVOLUTION_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not commit or paste real secrets into GitHub or chat.

## Build and start

Run from the repository root after reviewing the .env file:

```sh
docker compose -f compose.yaml config
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs --tail=100 diamante-os
```

The app container joins the existing Evolution Docker network as a client only. Do not run `docker compose down` against the Evolution project and do not recreate `evolution-api` or `evolution-db`.

## Nginx

Follow `deploy/nginx/README.md`. Nginx changes require root and must only be activated after the app health endpoint responds on 127.0.0.1:3000.

## Validation

- `curl -fsS http://127.0.0.1:3000/health`
- Main domain returns the institutional homepage.
- Store domain returns the WhatsApp OTP login.
- Admin domain returns the WhatsApp OTP login and server-side role checks.
- Evolution domain continues to require Basic Auth.
- Test a real OTP only with an active, authorised employee number and explicit approval to send a live WhatsApp message.
