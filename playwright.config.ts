import { defineConfig } from "@playwright/test";

// Local smoke test only (no CI): `npm run test:e2e`.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5178",
    // The installed Google Chrome, so no browser download is needed.
    channel: "chrome",
  },
  webServer: {
    command: "npx vite --port 5178 --strictPort",
    url: "http://localhost:5178",
    reuseExistingServer: true,
  },
});
