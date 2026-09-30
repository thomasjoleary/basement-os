import { test, expect, type Page } from '@playwright/test'
import { instantiateTemplate } from '../../lib/ship-templates'
import { type Ship } from '../../lib/ships'

const gm = '10000000-0000-0000-0000-000000000001', player = '10000000-0000-0000-0000-000000000002'
const shipId = '20000000-0000-0000-0000-000000000001'
async function backend(page: Page, role: 'gm' | 'player' | 'outsider' | 'anon' = 'gm') {
  const ships = new Map<string, Ship>([[shipId, { id: shipId, name: 'Test Freighter', description: '', owner_id: player, crew_ids: [], plan: instantiateTemplate('freighter'), version: 1 }]])
  const notes = new Map([[shipId, 'GM SECRET']])
  const stats = { saves: 0, notesReads: 0, failSave: false, staleSave: false }
  const user = role === 'gm' ? gm : player
  if (role !== 'anon') await page.addInitScript(({ user }) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'local-test-token', refresh_token: 'local-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: { id: user, aud: 'authenticated', role: 'authenticated', email: 'test@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }))
  }, { user })
  await page.route('http://127.0.0.1:54321/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname
    const fulfill = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path.includes('/rpc/campaign_access_status')) return fulfill({ status: 'approved', is_gm: role === 'gm' })
    if (path.includes('/profiles')) return fulfill(url.searchParams.get('select') === 'role' ? { role: role === 'gm' ? 'gm' : 'player' } : [{ id: gm, username: 'GM' }, { id: player, username: 'Pilot' }])
    if (path.includes('/v2_ship_gm_notes')) { stats.notesReads++; return fulfill({ notes: notes.get(url.searchParams.get('ship_id')?.slice(3) ?? '') ?? '' }) }
    if (path.includes('/rpc/v2_save_ship')) {
      const data = route.request().postDataJSON()
      if (stats.failSave) return fulfill({ message: 'Test connection failed', code: '08006' }, 500)
      if (stats.staleSave) return fulfill({ message: 'Ship changed in another session. Reload before saving.', code: '40001' }, 409)
      if (role !== 'gm') return fulfill({ message: 'GM access required', code: '42501' }, 403)
      const previous = ships.get(data.ship_id)
      const ship: Ship = { id: data.ship_id, name: data.ship_name, description: data.ship_description, owner_id: data.ship_owner, crew_ids: data.ship_crew, plan: data.ship_plan, version: (previous?.version ?? 0) + 1 }
      ships.set(ship.id, ship); notes.set(ship.id, data.private_notes); stats.saves++
      return fulfill(ship)
    }
    if (path.includes('/v2_ships')) {
      const id = url.searchParams.get('id')?.slice(3)
      if (id) return fulfill(role === 'outsider' ? null : ships.get(id) ?? null)
      return fulfill(role === 'outsider' ? [] : [...ships.values()])
    }
    return fulfill({})
  })
  return { ships, notes, stats }
}
async function cell(page: Page, x: number, y: number) {
  return page.getByTestId('ship-grid').locator('g').first().evaluate((el, p) => {
    const matrix = (el as SVGGraphicsElement).getScreenCTM()!
    const at = new DOMPoint(p.x * 32 + 16, p.y * 32 + 16).matrixTransform(matrix)
    return { x: at.x, y: at.y }
  }, { x, y })
}
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 5 }); await page.mouse.up()
}

test('templates create independent ships, repeated creation and cancel', async ({ page }) => {
  const api = await backend(page)
  await page.setViewportSize({ width: 1366, height: 800 })
  await page.goto('/v2/ships')
  await page.getByRole('button', { name: 'New ship', exact: true }).click()
  await page.getByLabel('Ship name').fill('Cancel this')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(api.stats.saves).toBe(0)
  for (const template of ['fighter', 'freighter']) {
    await page.getByRole('button', { name: 'New ship', exact: true }).click()
    await page.getByLabel('Ship name').fill(`New ${template}`)
    await page.getByLabel('Starting plan').selectOption(template)
    await page.getByRole('button', { name: 'Create ship', exact: true }).dblclick()
    await expect(page.getByRole('heading', { name: `New ${template}` })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366)
    if (template === 'freighter') await page.getByLabel('Current deck').selectOption({ label: 'Cargo deck' })
    await page.screenshot({ path: `test-results/ship-template-${template}.png`, fullPage: true })
    const current = [...api.ships.values()].find(s => s.name === `New ${template}`)!
    const booster = current.plan.parts.find(p => p.type === 'Booster')!
    await page.locator(`[data-kind="part"][data-id="${booster.id}"]`).click()
    await expect(page.getByLabel('Component name')).toHaveValue(booster.name)
    await expect(page.getByLabel('Type', { exact: true })).toHaveValue('Booster')
    await expect(page.getByText('All changes saved', { exact: false })).toBeVisible()
    await page.getByRole('link', { name: 'Back to ships' }).click()
  }
  expect(api.stats.saves).toBe(2); expect(api.ships.size).toBe(3)
  const ids = [...api.ships.values()].flatMap(s => s.plan.decks.map(d => d.id))
  expect(new Set(ids).size).toBe(ids.length)
})

test('room/fixture editing, quality tags, deck changes, save/reload and discard', async ({ page }) => {
  const api = await backend(page)
  await page.goto(`/v2/ships/${shipId}`)
  await expect(page.getByRole('heading', { name: 'Test Freighter' })).toBeVisible()
  await page.getByRole('button', { name: 'Add deck', exact: true }).click()
  await page.getByLabel('Deck name', { exact: true }).fill('Workshop deck')
  await page.getByRole('button', { name: 'room', exact: true }).click()
  await drag(page, await cell(page, 2, 2), await cell(page, 7, 6))
  await page.getByLabel('Room name').fill('Workshop')
  await page.getByRole('button', { name: 'fixture', exact: true }).click()
  const pos = await cell(page, 3, 3); await page.mouse.click(pos.x, pos.y)
  await page.getByLabel('Component name').fill('Repair bench')
  await page.getByLabel('Quality', { exact: true }).selectOption('Specialized')
  await page.getByLabel('Black Market', { exact: true }).check()
  await page.getByLabel('Physical condition').selectOption('Worn')
  await page.getByLabel('Quantity').fill('2')
  await page.getByRole('button', { name: 'select', exact: true }).click()
  await drag(page, await cell(page, 3, 3), await cell(page, 5, 4))
  await expect(page.getByLabel('Position x')).toHaveValue('5')
  await page.getByLabel('Current deck').selectOption({ label: 'Cargo deck' })
  await page.getByLabel('Current deck').selectOption({ label: 'Workshop deck' })
  await page.getByRole('button', { name: 'Connect decks', exact: true }).click()
  await page.getByLabel('Connection name').fill('Workshop stairs')
  await page.getByLabel('from x').fill('3'); await page.getByLabel('from y').fill('5')
  await page.getByRole('button', { name: 'Ship', exact: true }).click()
  await page.getByLabel('GM-only notes').fill('Hidden cargo')
  await page.getByRole('button', { name: 'Save ship', exact: true }).dblclick()
  await expect(page.getByRole('status')).toHaveText('Ship saved.')
  expect(api.stats.saves).toBe(1)
  const bench = api.ships.get(shipId)!.plan.parts.find(p => p.name === 'Repair bench')!
  expect(bench).toMatchObject({ x: 5, y: 4, quality: 'Specialized', black_market: true, condition: 'Worn', quantity: 2 })
  expect(bench.room_id).toBeTruthy()
  await page.reload()
  await page.getByLabel('Current deck').selectOption({ label: 'Workshop deck' })
  await page.getByRole('button', { name: 'Inventory', exact: true }).click()
  await page.getByRole('button', { name: /Repair bench × 2/ }).click()
  await expect(page.getByLabel('Component name')).toHaveValue('Repair bench')
  await expect(page.getByLabel('Black Market', { exact: true })).toBeChecked()
  await page.getByLabel('Component name').fill('Unsaved rename')
  await page.evaluate(async () => {
    const channel = new BroadcastChannel('sb-127-auth-token')
    channel.postMessage({ event: 'TOKEN_REFRESHED', session: JSON.parse(localStorage.getItem('sb-127-auth-token')!) })
    await new Promise(resolve => setTimeout(resolve, 100))
    channel.close()
  })
  await expect(page.getByLabel('Component name')).toHaveValue('Unsaved rename')
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('link', { name: 'Back to ships' }).click()
  await expect(page.getByLabel('Component name')).toHaveValue('Unsaved rename')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect(page.getByText('All changes saved', { exact: false })).toBeVisible()
  await page.getByLabel('Current deck').selectOption({ label: 'Workshop deck' })
  await page.screenshot({ path: 'test-results/ship-workshop.png', fullPage: true })
})

test('wall/door/label tools repeat, Escape cancels room, zoom/pan and delete deck', async ({ page }) => {
  const api = await backend(page)
  await page.goto(`/v2/ships/${shipId}`)
  await page.getByRole('button', { name: 'Add deck', exact: true }).click()
  for (const tool of ['wall', 'door', 'label']) {
    await page.getByRole('button', { name: tool, exact: true }).click()
    await drag(page, await cell(page, 2, 3), await cell(page, 5, 3))
    await page.getByLabel('Label / name').fill(`Test ${tool}`)
  }
  await page.getByRole('button', { name: 'room', exact: true }).click()
  const a = await cell(page, 7, 7), b = await cell(page, 10, 10)
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y)
  await page.keyboard.press('Escape'); await page.mouse.up()
  await expect(page.getByLabel('Room name')).toHaveCount(0)
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(page.getByText(/125%/)).toBeVisible()
  await page.getByRole('button', { name: 'Fit deck' }).click()
  await page.getByRole('button', { name: 'pan', exact: true }).click()
  await drag(page, await cell(page, 3, 3), await cell(page, 6, 5))
  await page.getByRole('button', { name: 'Fit deck' }).click()
  await page.getByRole('button', { name: 'Save ship', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Ship saved.')
  expect(api.ships.get(shipId)!.plan.decks[2].marks).toHaveLength(3)
  expect(api.ships.get(shipId)!.plan.decks[2].rooms).toHaveLength(0)
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Delete deck', exact: true }).click()
  expect(api.ships.get(shipId)!.plan.decks).toHaveLength(3)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete deck', exact: true }).click()
  await page.getByRole('button', { name: 'Save ship', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Ship saved.')
  expect(api.ships.get(shipId)!.plan.decks).toHaveLength(2)
})

test('failed and conflicting saves retain edits and allow recovery', async ({ page }) => {
  const api = await backend(page)
  await page.goto(`/v2/ships/${shipId}`)
  await page.getByLabel('Deck name', { exact: true }).fill('Edited deck')
  api.stats.failSave = true
  await page.getByRole('button', { name: 'Save ship', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Test connection failed')
  await expect(page.getByLabel('Deck name', { exact: true })).toHaveValue('Edited deck')
  api.stats.failSave = false; api.stats.staleSave = true
  await page.getByRole('button', { name: 'Save ship', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('another session')
  api.stats.staleSave = false
  await page.getByRole('button', { name: 'Save ship', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Ship saved.')
})

test('assigned player inspects components and changes decks without edit controls or notes requests', async ({ page }) => {
  const api = await backend(page, 'player')
  await page.goto(`/v2/ships/${shipId}`)
  await expect(page.getByText('Assigned crew · read-only', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save ship', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'fixture', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Bedroom', exact: true }).click()
  await expect(page.getByLabel('Room name')).toBeDisabled()
  await page.getByRole('button', { name: 'Crew bunk × 1', exact: true }).click()
  await expect(page.getByLabel('Component name')).toBeDisabled()
  await page.getByLabel('Current deck').selectOption({ label: 'Cargo deck' })
  await page.getByRole('button', { name: 'Cargo lift', exact: true }).click()
  await page.getByRole('button', { name: 'Go to connected deck' }).click()
  await expect(page.getByLabel('Current deck')).toHaveValue(api.ships.get(shipId)!.plan.decks[0].id)
  await page.screenshot({ path: 'test-results/ship-player.png', fullPage: true })
  expect(api.stats.notesReads).toBe(0); expect(api.stats.saves).toBe(0)
})

test('unassigned and anonymous users cannot open a ship editor', async ({ page, context }) => {
  await backend(page, 'outsider')
  await page.goto(`/v2/ships/${shipId}`)
  await expect(page.locator('main').getByRole('alert')).toContainText('Ship unavailable')
  await expect(page.getByTestId('ship-grid')).toHaveCount(0)
  const anonymous = await context.newPage()
  await backend(anonymous, 'anon')
  await anonymous.goto(`/v2/ships/${shipId}`)
  // New page shares storage: explicitly remove the previous test session.
  await anonymous.evaluate(() => localStorage.clear())
  await anonymous.reload()
  await expect(anonymous.getByRole('link', { name: 'Sign in or request access' })).toBeVisible()
})

test('mobile deck and inventory controls remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await backend(page)
  await page.goto(`/v2/ships/${shipId}`)
  await page.getByLabel('Current deck').selectOption({ label: 'Cargo deck' })
  await page.getByRole('button', { name: 'Inventory', exact: true }).click()
  await page.getByRole('button', { name: /Main propulsion × 1/ }).click()
  await expect(page.getByLabel('Component name')).toHaveValue('Main propulsion')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/ship-mobile.png', fullPage: true })
})

test('laptop layout contains long names while canvas zoom and pan stay inside the map', async ({ page }) => {
  const api = await backend(page)
  const ship = api.ships.get(shipId)!
  ship.name = 'LongShipName'.repeat(10)
  ship.plan.decks[0].name = 'LongDeckName'.repeat(10)
  for (const width of [1024, 1280, 1366, 1440, 1536]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto(`/v2/ships/${shipId}`)
    await expect(page.getByRole('heading', { name: ship.name })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `page width at ${width}`).toBeLessThanOrEqual(width)
    await page.getByRole('button', { name: 'pan', exact: true }).click()
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await drag(page, await cell(page, 3, 3), await cell(page, 8, 5))
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `panned page width at ${width}`).toBeLessThanOrEqual(width)
    await page.getByRole('button', { name: 'Fit deck' }).click()
    await page.getByRole('button', { name: 'Ship', exact: true }).click()
    await expect(page.getByLabel('GM-only notes')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    if (width === 1366) await page.screenshot({ path: 'test-results/ship-laptop-long-names.png', fullPage: true })
  }
})


test('selection cannot move a fixture when the canvas reflows under a stationary pointer', async ({ page }) => {
  await backend(page)
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto(`/v2/ships/${shipId}`)
  await expect(page.getByTestId('ship-grid')).toBeVisible()
  const at = await cell(page, 8, 2)
  await page.mouse.move(at.x, at.y); await page.mouse.down()
  await expect(page.getByLabel('Component name')).toHaveValue('Flight console')
  await page.getByTestId('ship-grid').evaluate(el => { el.style.transform = 'translateY(64px)' })
  await page.mouse.up()
  await expect(page.getByLabel('Position x')).toHaveValue('8')
  await expect(page.getByLabel('Position y')).toHaveValue('2')
  await expect(page.getByText('All changes saved', { exact: false })).toBeVisible()
})


test('different inspector heights keep laptop canvas and viewport fixed across repeated selections', async ({ page }) => {
  await backend(page)
  for (const [width, height] of [[1024, 768], [1280, 800], [1366, 900], [1440, 900]]) {
    await page.setViewportSize({ width, height })
    await page.goto(`/v2/ships/${shipId}`)
    const grid = page.getByTestId('ship-grid')
    await expect(grid).toBeVisible()
    const before = await grid.boundingBox()
    const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }))
    for (let repeat = 0; repeat < 3; repeat++) {
      for (const [x, y] of [[8, 2], [6, 3], [10, 13], [0, 0]]) {
        const at = await cell(page, x, y); await page.mouse.click(at.x, at.y)
        expect(await grid.boundingBox()).toEqual(before)
        expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(scroll)
        await expect(page.getByText('All changes saved', { exact: false })).toBeVisible()
      }
    }
    const at = await cell(page, 8, 2); await page.mouse.click(at.x, at.y)
    await expect(page.getByLabel('Position x')).toHaveValue('8')
    await expect(page.getByLabel('Position y')).toHaveValue('2')
    expect(await page.locator('aside').evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true)
    if (width === 1366) await page.screenshot({ path: 'test-results/ship-stable-inspector-laptop.png', fullPage: true })
  }
})

test('part drag requires deliberate movement and cancelled capture never commits', async ({ page }) => {
  await backend(page)
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto(`/v2/ships/${shipId}`)
  await expect(page.getByTestId('ship-grid')).toBeVisible()
  let at = await cell(page, 8, 2)
  await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x + 3, at.y + 3); await page.mouse.up()
  await expect(page.getByText('All changes saved', { exact: false })).toBeVisible()
  for (const event of ['pointercancel', 'lostpointercapture']) {
    at = await cell(page, 8, 2)
    await page.mouse.move(at.x, at.y); await page.mouse.down()
    const to = await cell(page, 9, 3); await page.mouse.move(to.x, to.y, { steps: 5 })
    await page.getByTestId('ship-grid').dispatchEvent(event, { pointerId: 1 })
    await page.mouse.up()
    await expect(page.getByLabel('Position x')).toHaveValue('8')
    await expect(page.getByLabel('Position y')).toHaveValue('2')
    await expect(page.getByText('All changes saved', { exact: false })).toBeVisible()
  }
  await drag(page, await cell(page, 8, 2), await cell(page, 9, 3))
  await expect(page.getByLabel('Position x')).toHaveValue('9')
  await expect(page.getByLabel('Position y')).toHaveValue('3')
  await page.getByRole('button', { name: 'Save ship', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Ship saved.')
  await page.reload()
  const to = await cell(page, 9, 3); await page.mouse.click(to.x, to.y)
  await expect(page.getByLabel('Position x')).toHaveValue('9')
  await expect(page.getByLabel('Position y')).toHaveValue('3')
})
