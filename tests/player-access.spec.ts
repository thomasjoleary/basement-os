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

async function injectSession(page: Page, baseURL = BASE_URL) {
  // Navigate to the app first to establish the domain context for localStorage
  await page.goto(baseURL)
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

  for (const [label, target] of [['preview', BASE_URL], ['production', 'https://basementos.xyz']] as const) {
    test(`${label} approved reads and private Realtime work after public channels are disabled`, async ({ page }) => {
      test.setTimeout(90000)
      expect(ownCharacterId, 'Existing CI player must have a character for this read-only smoke').toBeTruthy()
      let writeAttempts = 0
      await page.route(`${new URL(SUPABASE_URL).origin}/rest/v1/**`, async route => {
        const request = route.request()
        const statusRead = request.method() === 'POST' && new URL(request.url()).pathname === '/rest/v1/rpc/campaign_access_status'
        if (!['GET', 'HEAD'].includes(request.method()) && !statusRead) {
          writeAttempts++; await route.abort(); return
        }
        await route.continue()
      })
      if (target !== BASE_URL) await injectSession(page, target)
      const read = page.waitForResponse(response => {
        const url = new URL(response.url())
        return url.pathname === '/rest/v1/characters' && url.searchParams.get('id') === `eq.${ownCharacterId}`
      })
      await page.goto(`${target}/character/${ownCharacterId}`)
      const response = await read
      expect(response.status()).toBe(200)
      expect((await response.json()).id === ownCharacterId).toBe(true)
      await expect(page.getByRole('heading', { name: 'Waiting for GM approval' })).toHaveCount(0)
      const results = await page.evaluate(async ({ endpoint, apiKey, storageKey }) => {
        const token = JSON.parse(localStorage.getItem(storageKey) || '{}').access_token
        if (!token) throw new Error('Existing session missing; no credentials created')
        async function join(isPrivate: boolean, authenticated: boolean): Promise<{ status: string; bindings: number }> {
          const url = new URL('/realtime/v1/websocket', endpoint)
          url.protocol = 'wss:'
          url.searchParams.set('apikey', apiKey)
          url.searchParams.set('vsn', '2.0.0')
          return new Promise(resolve => {
            const socket = new WebSocket(url)
            let finished = false
            const finish = (status: string, bindings = 0) => {
              if (finished) return
              finished = true; clearTimeout(timer); socket.close(); resolve({ status, bindings })
            }
            const timer = setTimeout(() => finish('timeout'), 12000)
            socket.onopen = () => socket.send(JSON.stringify(['1', '1', 'realtime:map_markers_changes', 'phx_join', {
              config: { private: isPrivate, broadcast: { ack: false, self: false }, presence: { key: '', enabled: false },
                postgres_changes: [{ event: '*', schema: 'public', table: 'map_markers' }] },
              access_token: authenticated ? token : apiKey,
            }]))
            socket.onmessage = event => {
              if (typeof event.data !== 'string') return
              const message = JSON.parse(event.data)
              // Ignore all campaign events; retain only the sanitized join acknowledgement.
              if (Array.isArray(message) && message[1] === '1' && message[3] === 'phx_reply') {
                finish(message[4]?.status ?? 'invalid', message[4]?.response?.postgres_changes?.length ?? 0)
              }
            }
            socket.onerror = () => finish('transport-error')
            socket.onclose = () => finish('closed')
          })
        }
        return {
          approvedPrivate: await join(true, true), approvedPublic: await join(false, true),
          anonymousPrivate: await join(true, false), anonymousPublic: await join(false, false),
        }
      }, { endpoint: SUPABASE_URL, apiKey: SUPABASE_ANON_KEY, storageKey: AUTH_STORAGE_KEY })
      expect(results).toEqual({
        approvedPrivate: { status: 'ok', bindings: 1 }, approvedPublic: { status: 'error', bindings: 0 },
        anonymousPrivate: { status: 'error', bindings: 0 }, anonymousPublic: { status: 'error', bindings: 0 },
      })
      expect(writeAttempts).toBe(0)
      console.log(`::notice title=Post-lock Realtime smoke ${label}::Approved character read HTTP 200; intended private map channel joined; authenticated public and anonymous private/public channels rejected. Zero campaign writes or broadcasts. Existing CI identity only.`)
    })
  }

  test.describe('Live ship schema smoke', () => {
    test('preview reads migrated ship storage without errors or campaign writes', async ({ page }) => {
      test.setTimeout(60000)
      let assignedShip: string | undefined
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
        const rows = await response.json()
        expect(Array.isArray(rows)).toBe(true)
        assignedShip = typeof rows[0]?.id === 'string' ? rows[0].id : undefined
        await expect(page.getByRole('heading', { name: 'Ships', exact: true })).toBeVisible()
        await expect(page.getByText('Loading ships…', { exact: true })).toHaveCount(0)
        await expect(page.locator('main').getByRole('alert')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'New ship', exact: true })).toHaveCount(0)
      }
      if (assignedShip) {
        await page.goto(`${BASE_URL}/v2/ships/${assignedShip}`)
        for (const view of ['Cutaway', 'Exterior']) {
          await page.getByRole('button', { name: view, exact: true }).click()
          await expect(page.getByTestId('ship-3d-canvas')).toBeVisible({ timeout: 20000 })
          await page.getByRole('button', { name: 'Reset view', exact: true }).click()
        }
        await page.getByRole('button', { name: '2D', exact: true }).click()
        await expect(page.getByTestId('ship-grid')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Save ship', exact: true })).toHaveCount(0)
        console.log('::notice title=Live 3D ship smoke::Assigned-player Cutaway, Exterior and return to 2D loaded successfully; read-only existing ship, no edits or screenshots.')
      } else {
        console.log('::notice title=Live 3D smoke limit::CI player has no assigned ships; live 3D inspection was not possible without changing campaign access/data. Local 3D browser tests cover rendering, heights and interactions.')
      }
      expect({ browserErrors, failedShipRequests, writeAttempts, privateNoteReads }).toEqual({ browserErrors: 0, failedShipRequests: 0, writeAttempts: 0, privateNoteReads: 0 })
      console.log('::notice title=Live ship schema smoke::Ship list and reload passed against migrated schema; HTTP 200; zero browser errors, failed ship requests, private-note reads or campaign writes. No template copies created.')
    })
  })
})
