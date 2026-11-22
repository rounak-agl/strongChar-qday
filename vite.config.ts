import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

// The public REST APIs send no CORS headers, so the browser reaches them
// through the dev (and preview) server: /lcd-testnet and /lcd-mainnet are
// forwarded to each network's REST endpoint (see REST_PROXY in src/App.tsx).
// In production, serve the app behind a proxy that does the same.
const rest = (target: string) => ({
  target,
  changeOrigin: true,
  rewrite: (p: string) => p.replace(/^\/lcd-(testnet|mainnet)/, ""),
});
const proxy = {
  "/lcd-testnet": rest("https://api-testnet.qore.host"),
  "/lcd-mainnet": rest("https://api.qore.host"),
};

// /api/registrations is a Vercel function in production; the dev server answers it with the same code.
const registrations = (load: () => Promise<{ GET: () => Promise<Response> }>): Connect.NextHandleFunction => async (_req, res) => {
  const r = await (await load()).GET();
  res.statusCode = r.status;
  res.setHeader("content-type", "application/json");
  res.end(await r.text());
};
const api: Plugin = {
  name: "registrations-api",
  configureServer(server) {
    server.middlewares.use("/api/registrations", registrations(() => server.ssrLoadModule("/api/registrations.ts") as any));
  },
};

export default defineConfig({
  plugins: [react(), api],
  server: { port: 5173, proxy },
  preview: { proxy },
});
