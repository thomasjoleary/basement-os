import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = (process.env.TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const PLAYER_EMAIL = process.env.PLAYER_EMAIL!
const PLAYER_PASSWORD = process.env.PLAYER_PASSWORD!

async function loginViaUI(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', PLAYER_EMAIL)
  await page.fill('input[type="password"]', PLAYER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 })
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
    await loginViaUI(page)
  })

  test('player can view their own character sheet', async ({ page }) => {
    if (!ownCharacterId) {
      test.skip(true, 'No character is assigned to the test player account')
    }
    await page.goto(`${BASE_URL}/character/${ownCharacterId}`)
    await expect(page).toHaveURL(new RegExp(`/character/${ownCharacterId}`))
  })

  test('player cannot view another player\'s character sheet', async ({ page }) => {
    if (!otherCharacterId) {
      test.skip(true, 'No other player character found in the database')
    }
    await page.goto(`${BASE_URL}/character/${otherCharacterId}`)
    // The page redirects back to home for unauthorized access
    await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 10000 })
  })
})
