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
})
