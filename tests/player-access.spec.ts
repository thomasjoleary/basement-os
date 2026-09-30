import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = (process.env.TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const PLAYER_EMAIL = process.env.PLAYER_EMAIL!
const PLAYER_PASSWORD = process.env.PLAYER_PASSWORD!

// Supabase JS v2 stores the session in localStorage under this key
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
const AUTH_STORAGE_KEY = `sb-${projectRef}-auth-token`

let savedSession: object

// These tests use real accounts; do not capture account/data traces or screenshots.
test.use({ trace: 'off', screenshot: 'off' })

async function injectSession(page: Page) {
  // Navigate to the app first to establish the domain context for localStorage
  await page.goto(BASE_URL)
  await page.evaluate(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    { key: AUTH_STORAGE_KEY, session: savedSession }
  )
  // Reload so the Supabase client picks up the injected session
  await page.reload()
}

test.describe('Player character sheet access', () => {
  let playerUserId: string
  let ownCharacterId: string | undefined
  let otherCharacterId: string | undefined

  test.beforeAll(async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: PLAYER_EMAIL,
      password: PLAYER_PASSWORD,
    })
    if (error || !authData.user) throw new Error(`Auth setup failed: ${error?.message}`)
    playerUserId = authData.user.id
    savedSession = authData.session!

    // Find a character owned by this player
    const { data: own } = await supabase
      .from('characters')
      .select('id')
      .eq('user_id', playerUserId)
      .limit(1)
    ownCharacterId = own?.[0]?.id

    // Find a character owned by a different player
    const { data: other } = await supabase
      .from('characters')
      .select('id')
      .neq('user_id', playerUserId)
      .not('user_id', 'is', null)
      .eq('is_npc', false)
      .eq('is_tame', false)
      .limit(1)
    otherCharacterId = other?.[0]?.id

    await supabase.auth.signOut()
  })

  test.beforeEach(async ({ page }) => {
    // Report only the non-secret project ref actually contacted by the preview.
    // CI's existing Vercel bypass is used normally; no credentials are logged.
    const observed = new Set<string>()
    page.on('request', request => {
      const host = new URL(request.url()).hostname
      if (/^[a-z0-9]+\.supabase\.co$/.test(host) && !observed.has(host)) {
        observed.add(host)
        console.log(`::notice title=Observed preview Supabase project::${host.split('.')[0]}`)
      }
    })
    await injectSession(page)
  })

  test('player can view their own character sheet', async ({ page }) => {
    if (!ownCharacterId) {
      test.skip(true, 'No character is assigned to the test player account')
    }
    await page.goto(`${BASE_URL}/character/${ownCharacterId}`)
    await expect(page).toHaveURL(new RegExp(`/character/${ownCharacterId}`))
  })

  test("player cannot view another player's character sheet", async ({ page }) => {
    if (!otherCharacterId) {
      test.skip(true, 'No other player character found in the database')
    }
    await page.goto(`${BASE_URL}/character/${otherCharacterId}`)
    await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 10000 })
  })

  test.describe('Live ship schema smoke', () => {
    test('preview reads migrated ship storage without errors or campaign writes', async ({ page }) => {
      let browserErrors = 0, failedShipRequests = 0, writeAttempts = 0, privateNoteReads = 0
      page.on('pageerror', () => { browserErrors++ })
      page.on('console', message => { if (message.type() === 'error') browserErrors++ })
      page.on('requestfailed', request => { if (new URL(request.url()).pathname.includes('v2_ship')) failedShipRequests++ })
      // Fail closed for mutations; the approval-status RPC is explicitly read-only.
      await page.route(`${new URL(SUPABASE_URL).origin}/rest/v1/**`, async route => {
        const request = route.request()
        const isStatusRead = request.method() === 'POST' && new URL(request.url()).pathname === '/rest/v1/rpc/campaign_access_status'
        if (!['GET', 'HEAD'].includes(request.method()) && !isStatusRead) {
          writeAttempts++; await route.abort(); return
        }
        if (new URL(route.request().url()).pathname.includes('v2_ship_gm_notes')) privateNoteReads++
        await route.continue()
      })
      for (const reload of [false, true]) {
        const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/rest/v1/v2_ships')
        if (reload) await page.reload()
        else await page.goto(`${BASE_URL}/v2/ships`)
        const response = await responsePromise
        expect(response.request().method()).toBe('GET')
        expect(response.status()).toBe(200)
        expect(new URL(response.url()).origin).toBe(new URL(SUPABASE_URL).origin)
        expect(Array.isArray(await response.json())).toBe(true)
        await expect(page.getByRole('heading', { name: 'Ships', exact: true })).toBeVisible()
        await expect(page.getByText('Loading ships…', { exact: true })).toHaveCount(0)
        await expect(page.locator('main').getByRole('alert')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'New ship', exact: true })).toHaveCount(0)
      }
      expect({ browserErrors, failedShipRequests, writeAttempts, privateNoteReads }).toEqual({ browserErrors: 0, failedShipRequests: 0, writeAttempts: 0, privateNoteReads: 0 })
      console.log('::notice title=Live ship schema smoke::Ship list and reload passed against migrated schema; HTTP 200; zero browser errors, failed ship requests, private-note reads or campaign writes. No template copies created.')
    })
  })
})
