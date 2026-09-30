import { defineConfig, devices } from '@playwright/test'

// Browser interactions use a mocked, local-only Supabase transport. Actual
// database permissions/transactions are tested separately by test:ships.
export default defineConfig({
  testDir: './tests/ships',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/v2/ships', timeout: 180000, reuseExistingServer: false,
    env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-test-only', NEXT_TELEMETRY_DISABLED: '1' },
  },
})
