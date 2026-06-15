import { defineConfig, devices } from '@playwright/test'

// When testing a Vercel deployment that has Deployment Protection enabled,
// this secret lets automated requests bypass the Vercel SSO login wall.
// Sent as a header on every request. See:
// https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    extraHTTPHeaders: bypassSecret
      ? {
          'x-vercel-protection-bypass': bypassSecret,
          'x-vercel-set-bypass-cookie': 'true',
        }
      : undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
