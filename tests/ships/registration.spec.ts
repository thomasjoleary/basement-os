import { test, expect, type Page } from '@playwright/test'

const account='10000000-0000-0000-0000-000000000001'
async function backend(page: Page, role: 'gm' | 'player' | 'pending' = 'pending') {
  const state = { status: role === 'pending' ? 'pending' : 'approved', isGM: role === 'gm', approvals: 0, campaignReads: 0, fail: false, missing: false, request: true, system: true }
  await page.addInitScript(({ account }) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'local-test-token', refresh_token: 'local-refresh', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user: { id: account, aud: 'authenticated', role: 'authenticated', email: 'local@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }))
  }, { account })
  await page.route('http://127.0.0.1:54321/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    const fulfill = (data: unknown, status=200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path.endsWith('/campaign_access_status')) return state.missing ? fulfill({ code: 'PGRST202', message: 'not installed' },404) : fulfill({ status: state.status, is_gm: state.isGM })
    if (path.endsWith('/list_registration_requests')) return state.isGM ? fulfill(state.request ? [{ id: account, username: 'Applicant', email: 'applicant@example.invalid', created_at: '2026-09-30T10:00:00Z' }] : []) : fulfill({code:'42501',message:'GM only'},403)
    if (path.endsWith('/approve_registration')) {
      if (state.fail) return fulfill({code:'08006',message:'Test connection error'},500)
      if (!state.isGM) return fulfill({code:'42501',message:'GM only'},403)
      state.approvals++; state.request=false; return fulfill(true)
    }
    if (path.includes('/rest/v1/')) state.campaignReads++
    if (path.endsWith('/profiles')) return fulfill({ role: state.isGM ? 'gm' : 'player' })
    if (path.endsWith('/v2_galaxy_settings')) return fulfill(null)
    if (path.endsWith('/v2_star_systems')) return fulfill(state.system ? [{id:account,name:'Polling system',x:0,y:0,z:0,description:'',gm_notes:'',discovered:true,tags:[],created_by:account,created_at:'2026-01-01',updated_at:'2026-01-01'}] : [])
    return fulfill([])
  })
  return state
}

test('pending direct routes mount no campaign UI or campaign requests; approval unlocks after refresh',async({page})=>{
  const state=await backend(page)
  for(const path of ['/','/v2/ships','/v2/galaxy','/wiki','/map','/approvals']){
    await page.goto(path)
    await expect(page.getByRole('heading',{name:'Waiting for GM approval'})).toBeVisible()
    expect(state.campaignReads).toBe(0)
    await expect(page.getByRole('link',{name:'Registration approvals'})).toHaveCount(0)
  }
  await page.goto('/v2/ships')
  await expect(page.getByRole('heading',{name:'Waiting for GM approval'})).toBeVisible()
  await page.screenshot({ path: 'test-results/registration-pending.png', fullPage: true })
  state.status='approved'
  await page.getByRole('button',{name:'Check again'}).click()
  await expect(page.getByRole('heading',{name:'Ships',exact:true})).toBeVisible()
})

test('missing migration fails closed with clear setup message and public login remains reachable',async({page})=>{
  const state=await backend(page,'player'); state.missing=true
  await page.goto('/v2/ships')
  await expect(page.locator('main').getByRole('alert')).toContainText('finish setup')
  expect(state.campaignReads).toBe(0)
  await page.goto('/login')
  await expect(page.getByRole('heading',{name:'IDENTIFY YOURSELF'})).toBeVisible()
})

test('GM reviews, cancels, retries failed approval and cannot submit twice',async({page})=>{
  const state=await backend(page,'gm')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/approvals')
  await page.getByRole('button',{name:'Review Applicant'}).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/registration-gm-review-mobile.png', fullPage: true })
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  expect(state.approvals).toBe(0)
  await page.getByRole('button',{name:'Review Applicant'}).click()
  state.fail=true
  await page.getByRole('button',{name:'Approve player',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Approval failed')
  await expect(page.getByRole('dialog')).toBeVisible()
  state.fail=false
  await page.getByRole('button',{name:'Approve player',exact:true}).dblclick()
  await expect(page.getByRole('status')).toHaveText('Account approved.')
  expect(state.approvals).toBe(1)
  await page.reload()
  await expect(page.getByText('No registrations are waiting for approval.')).toBeVisible()
})

test('approved player cannot use the GM approval screen',async({page})=>{
  await backend(page,'player');await page.goto('/approvals')
  await expect(page.getByRole('status')).toContainText('Only approved GMs')
  await expect(page.getByRole('button',{name:'Approve player'})).toHaveCount(0)
})

test('authorized galaxy deletion refetch removes stale system without DELETE event',async({page})=>{
  const state=await backend(page,'gm')
  await page.clock.install()
  await page.goto('/v2/galaxy')
  await expect(page.getByText('Polling system').first()).toBeVisible()
  state.system=false
  await page.clock.fastForward(16000)
  await expect(page.getByText('No systems yet')).toBeVisible()
  await expect(page.getByText('Polling system')).toHaveCount(0)
})
