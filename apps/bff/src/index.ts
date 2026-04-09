import 'dotenv/config';
import { createServer } from './server.js';

/** Render and other hosts set `PORT`; local default 3000. */
function listenPort(): number {
  const raw = process.env.PORT ?? '3000';
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

/** Bind all interfaces (required for Render, Docker, etc.). Override with `BFF_LISTEN_HOST` if needed. */
function listenHost(): string {
  const h = process.env.BFF_LISTEN_HOST?.trim();
  return h && h.length > 0 ? h : '0.0.0.0';
}

const port = listenPort();
const host = listenHost();

createServer().listen(port, host, () => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: 'bff_listen',
      service: 'redesas-lite-bff',
      host,
      port,
    }),
  );
});
