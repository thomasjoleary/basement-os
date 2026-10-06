import * as THREE from 'three'
import {createSurfaceMeshes} from '../../lib/ship-surface-renderer'
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

test('unassigned and anonymous users cannot open a ship editor', async ({ page, browser }) => {
  await backend(page, 'outsider')
  await page.goto(`/v2/ships/${shipId}`)
  await expect(page.locator('main').getByRole('alert')).toContainText('Ship unavailable')
  await expect(page.getByTestId('ship-grid')).toHaveCount(0)
  // Isolate storage and auth broadcasts from the signed-in outsider tab.
  const anonymousContext = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const anonymous = await anonymousContext.newPage()
    await backend(anonymous, 'anon')
    await anonymous.goto(`/v2/ships/${shipId}`)
    await expect(anonymous.getByRole('link', { name: 'Sign in or request access' })).toBeVisible()
    await expect(anonymous.getByTestId('ship-grid')).toHaveCount(0)
  } finally { await anonymousContext.close() }
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


test('legacy height defaults, unsaved 3D switches, orbit, roofs, decks and save/reload', async ({ page }) => {
  const api=await backend(page)
  api.ships.get(shipId)!.plan.decks.forEach(d=>delete d.height_ft)
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:1366,height:900})
  await page.goto(`/v2/ships/${shipId}`)
  await expect(page.getByLabel('Deck height (feet)')).toHaveValue('8')
  await expect(page.getByText('All changes saved',{exact:false})).toBeVisible()
  await page.getByLabel('Deck height (feet)').fill('12')
  await page.getByRole('button',{name:'Cutaway',exact:true}).click()
  const canvas=page.getByTestId('ship-3d-canvas');await expect(canvas).toBeVisible({timeout:30000})
  await page.screenshot({path:'test-results/ship-cutaway-laptop.png'})
  const before=JSON.stringify(api.ships.get(shipId)!.plan)
  const rect=await canvas.boundingBox();expect(rect).not.toBeNull()
  await drag(page,{x:rect!.x+rect!.width*.5,y:rect!.y+rect!.height*.5},{x:rect!.x+rect!.width*.7,y:rect!.y+rect!.height*.6})
  await expect(page.getByLabel('Deck height (feet)')).toHaveValue('12')
  await page.getByLabel('Roofs',{exact:true}).check()
  await page.getByLabel('Show all decks',{exact:true}).check()
  await page.getByLabel('Exploded view',{exact:true}).check()
  await page.getByRole('button',{name:'Reset view',exact:true}).click()
  await page.getByRole('button',{name:'Zoom 3D in',exact:true}).click()
  await page.getByRole('button',{name:'Exterior',exact:true}).click()
  await expect(canvas).toBeVisible()
  await page.screenshot({path:'test-results/ship-exterior-laptop.png'})
  await page.getByRole('button',{name:'Inventory',exact:true}).click()
  await page.getByRole('button',{name:/Flight console.*1/}).click()
  await expect(page.getByLabel('Component name')).toHaveValue('Flight console')
  await page.getByRole('button',{name:'2D',exact:true}).click()
  await expect(page.getByLabel('Position x')).toHaveValue('8')
  expect(api.stats.saves).toBe(0);expect(JSON.stringify(api.ships.get(shipId)!.plan)).toBe(before)
  await page.getByRole('button',{name:'Save ship',exact:true}).click()
  await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible()
  expect(api.ships.get(shipId)!.plan.decks[0].height_ft).toBe(12)
  await page.reload();await expect(page.getByLabel('Deck height (feet)')).toHaveValue('12')
  expect(errors).toEqual([])
})

test('3D player inspection remains read-only, stable laptop/mobile layout and no private notes', async ({page})=>{
  const api=await backend(page,'player')
  await page.goto(`/v2/ships/${shipId}`)
  await page.getByRole('button',{name:'Exterior',exact:true}).click()
  await expect(page.getByTestId('ship-3d-canvas')).toBeVisible({timeout:30000})
  for(const width of [1024,1280,1366,390]){
    await page.setViewportSize({width,height:900})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
    await page.getByRole('button',{name:'Reset view',exact:true}).click()
  }
  await page.getByRole('button',{name:'Inventory',exact:true}).click()
  await page.getByRole('button',{name:/Rear booster 1.*1/}).click()
  await expect(page.getByLabel('Component name')).toBeDisabled()
  await expect(page.getByRole('button',{name:'Save ship',exact:true})).toHaveCount(0)
  expect(api.stats.notesReads).toBe(0);expect(api.stats.saves).toBe(0)
  await expect(page.getByText('GM SECRET')).toHaveCount(0)
})

test('WebGL fallback preserves unsaved heights and returns to 2D', async ({page})=>{
  await backend(page)
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext=function(this: HTMLCanvasElement,kind:string,...args:unknown[]){
      if(kind==='webgl2'||kind==='webgl'||kind==='experimental-webgl')return null
      return Reflect.apply(original,this,[kind,...args])
    } as typeof original
  })
  await page.goto(`/v2/ships/${shipId}`)
  await page.getByLabel('Deck height (feet)').fill('14')
  await page.getByRole('button',{name:'Cutaway',exact:true}).click()
  await expect(page.getByText('3D is unavailable on this device.',{exact:false})).toBeVisible({timeout:30000})
  await page.getByRole('button',{name:'Return to 2D',exact:true}).click()
  await expect(page.getByLabel('Deck height (feet)')).toHaveValue('14')
  await expect(page.getByText('Unsaved changes',{exact:false})).toBeVisible()
})


test('3D ray selection and cancelled orbit never edit the fighter; exterior screenshot', async ({page})=>{
  const api=await backend(page);api.ships.get(shipId)!.plan=instantiateTemplate('fighter')
  await page.setViewportSize({width:1366,height:900});await page.goto(`/v2/ships/${shipId}`)
  await page.getByRole('button',{name:'Cutaway',exact:true}).click()
  const canvas=page.getByTestId('ship-3d-canvas');await expect(canvas).toBeVisible({timeout:30000})
  const rect=await canvas.boundingBox()
  await canvas.click({position:{x:rect!.width*.5,y:rect!.height*.55}})
  await expect(page.getByRole('button',{name:'Deck setup',exact:false})).toBeVisible()
  await expect(page.getByText('All changes saved',{exact:false})).toBeVisible()
  const fixed=await canvas.boundingBox()
  await page.mouse.move(rect!.x+rect!.width*.5,rect!.y+rect!.height*.5);await page.mouse.down()
  await canvas.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up()
  expect(await canvas.boundingBox()).toEqual(fixed)
  await page.getByRole('button',{name:'Exterior',exact:true}).click();await expect(canvas).toBeVisible()
  await page.screenshot({path:'test-results/ship-fighter-exterior.png'})
  expect(api.stats.saves).toBe(0);await expect(page.getByText('All changes saved',{exact:false})).toBeVisible()
})


test('individual deck visibility and transparent hull are reversible view-only controls', async ({page})=>{
  const api=await backend(page);const original=JSON.stringify(api.ships.get(shipId)!.plan)
  await page.setViewportSize({width:1366,height:900});await page.goto(`/v2/ships/${shipId}`)
  await page.getByRole('button',{name:'Exterior',exact:true}).click()
  await expect(page.getByTestId('ship-3d-canvas')).toBeVisible({timeout:30000})
  await page.getByLabel('Transparent hull',{exact:true}).check()
  await page.getByLabel('Exploded view',{exact:true}).check()
  await page.getByLabel('Show deck Crew deck',{exact:true}).uncheck()
  await expect(page.getByLabel('Exploded view',{exact:true})).toBeDisabled()
  await expect(page.getByLabel('Exploded view',{exact:true})).not.toBeChecked()
  await page.getByLabel('Show deck Cargo deck',{exact:true}).uncheck()
  await expect(page.getByText('No decks visible.',{exact:false})).toBeVisible()
  await expect(page.getByLabel('Exploded view',{exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Restore hidden decks',exact:true}).click()
  await expect(page.getByLabel('Exploded view',{exact:true})).toBeEnabled()
  await expect(page.getByLabel('Exploded view',{exact:true})).toBeChecked()
  await page.getByLabel('Show all decks',{exact:true}).uncheck()
  await expect(page.getByLabel('Exploded view',{exact:true})).toBeDisabled()
  await page.getByLabel('Show all decks',{exact:true}).check()
  await expect(page.getByLabel('Show deck Crew deck',{exact:true})).toBeChecked()
  await page.getByLabel('Exploded view',{exact:true}).check()
  await page.screenshot({path:'test-results/ship-transparent-decks.png'})
  for(const width of [1024,1366,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)}
  await expect(page.getByText('All changes saved',{exact:false})).toBeVisible()
  expect(api.stats.saves).toBe(0);expect(JSON.stringify(api.ships.get(shipId)!.plan)).toBe(original)
})


test('appearance draft previews, saves and reloads colors markings and windows', async ({page})=>{
  const api=await backend(page)
  await page.setViewportSize({width:1366,height:900});await page.goto(`/v2/ships/${shipId}`)
  await page.getByRole('button',{name:'Ship',exact:true}).click()
  await page.getByLabel('Hull color',{exact:true}).fill('#456789')
  await page.getByLabel('Engine glow color',{exact:true}).fill('#ff4400')
  await page.getByLabel('Marking style',{exact:true}).selectOption('chevron')
  await page.getByRole('button',{name:'Add window',exact:true}).click()
  await page.getByLabel('Window 1 side',{exact:true}).selectOption('port')
  await page.getByLabel('Window 1 position',{exact:true}).fill('30')
  await page.getByRole('button',{name:'Exterior',exact:true}).click()
  await expect(page.getByTestId('ship-3d-canvas')).toBeVisible({timeout:30000})
  expect(api.stats.saves).toBe(0)
  await page.screenshot({path:'test-results/ship-custom-appearance.png'})
  await page.getByRole('button',{name:'Save ship',exact:true}).click()
  await expect(page.getByText('All changes saved',{exact:false})).toBeVisible()
  expect(api.ships.get(shipId)!.plan.appearance).toMatchObject({hull_color:'#456789',engine_color:'#ff4400',marking:'chevron',windows:[{side:'port',position:.3}]})
  await page.reload();await page.getByRole('button',{name:'Ship',exact:true}).click()
  await expect(page.getByLabel('Hull color',{exact:true})).toHaveValue('#456789')
  await expect(page.getByLabel('Window 1 side',{exact:true})).toHaveValue('port')
  await page.getByRole('button',{name:'Remove window 1',exact:true}).click()
  page.once('dialog',dialog=>dialog.accept())
  await page.getByRole('button',{name:'Discard changes',exact:true}).click()
  await page.getByRole('button',{name:'Ship',exact:true}).click()
  await expect(page.getByLabel('Window 1 side',{exact:true})).toHaveValue('port')
  for(const width of [1024,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
})


test('surface brush cancellation undo redo selection fill shape and save reload',async({page})=>{
  const api=await backend(page),plan=api.ships.get(shipId)!.plan,room=plan.decks[0].rooms[0]
  await page.setViewportSize({width:1366,height:900});await page.goto(`/v2/ships/${shipId}`)
  await page.locator(`[data-kind="room"][data-id="${room.id}"]`).first().click()
  const canvas=page.getByTestId('surface-paint-canvas');await expect(canvas).toBeVisible()
  await expect(page.getByText('All changes saved',{exact:false})).toBeVisible()
  async function square(x:number,y:number){await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!,scale=Math.min(600/(room.width*5),280/(room.height*5));return{x:b.x+(20+(x+.5)*scale)*b.width/640,y:b.y+(300-(y+.5)*scale)*b.height/320}}
  let from=await square(1,1),to=await square(4,1)
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y);await canvas.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up()
  await expect(page.getByText('All changes saved',{exact:false})).toBeVisible()
  from=await square(1,1);to=await square(4,1);await drag(page,from,to)
  await expect(page.getByRole('button',{name:'Undo map edit',exact:true})).toBeEnabled()
  await page.getByRole('button',{name:'Undo map edit',exact:true}).click();await page.getByRole('button',{name:'Redo map edit',exact:true}).click()
  await page.getByRole('button',{name:'select',exact:true}).last().click()
  await drag(page,await square(1,2),await square(3,3))
  await page.getByRole('button',{name:'Fill selection',exact:true}).click()
  await page.getByLabel('Surface',{exact:true}).selectOption('exterior-front')
  await page.getByLabel('Outward extension (feet)',{exact:true}).fill('9')
  await page.getByLabel('Roof bevel (feet)',{exact:true}).fill('1')
  await page.getByLabel('Section color',{exact:true}).fill('#aa44dd')
  await page.getByRole('button',{name:'Exterior',exact:true}).click()
  await expect(page.getByTestId('ship-3d-canvas')).toBeVisible({timeout:30000})
  await page.screenshot({path:'test-results/ship-surface-shaped.png'})
  await page.getByRole('button',{name:'Save ship',exact:true}).click()
  await expect(page.getByText('All changes saved',{exact:false})).toBeVisible()
  const saved=api.ships.get(shipId)!.plan.surface_design!
  expect(saved.surfaces.find(s=>s.face==='floor')!.paint.runs.length).toBeGreaterThan(0)
  expect(saved.sections[0]).toMatchObject({extension_ft:9,bevel_ft:1})
  await page.reload();await page.locator(`[data-kind="room"][data-id="${room.id}"]`).first().click()
  await page.getByLabel('Surface',{exact:true}).selectOption('exterior-front')
  await expect(page.getByLabel('Outward extension (feet)',{exact:true})).toHaveValue('9')
  await expect(page.getByLabel('Section color',{exact:true})).toHaveValue('#aa44dd')
})


test('painted crew views are read-only; orbit never changes surface selection or stored plan',async({page})=>{
 const api=await backend(page,'player'),plan=api.ships.get(shipId)!.plan,d=plan.decks[0],r=d.rooms[0]
 plan.surface_design={surfaces:[{id:'floor-paint',deck_id:d.id,room_id:r.id,face:'floor',paint:{palette:['#ff0000','#ffffff'],runs:[[1025,4,0],[2049,4,1]]}},{id:'roof-paint',deck_id:d.id,room_id:r.id,face:'roof',paint:{palette:['#ff0000'],runs:[[1025,4,0],[2049,4,0]]}}],sections:[],components:[]}
 const original=JSON.stringify(plan);let errors=0;page.on('pageerror',()=>errors++)
 await page.setViewportSize({width:1366,height:900});await page.goto(`/v2/ships/${shipId}`)
 await page.locator(`[data-kind="room"][data-id="${r.id}"]`).first().click()
 await expect(page.getByLabel('Paint color',{exact:true})).toBeDisabled()
 await expect(page.getByRole('button',{name:'Paint square',exact:true})).toBeDisabled()
 const flat=page.getByTestId('surface-paint-canvas');await flat.scrollIntoViewIfNeeded();await flat.click({force:true})
 await page.getByRole('button',{name:'Cutaway',exact:true}).click();await expect(page.getByTestId('ship-3d-canvas')).toBeVisible({timeout:30000})
 await page.screenshot({path:'test-results/ship-painted-interior.png'})
 await page.getByRole('button',{name:'Exterior',exact:true}).click()
 const canvas=page.getByTestId('ship-3d-canvas'),b=(await canvas.boundingBox())!
 await canvas.click({position:{x:b.width*.5,y:b.height*.5}})
 await expect(page.getByLabel('Surface',{exact:true})).toBeVisible()
 const face=await page.getByLabel('Surface',{exact:true}).inputValue()
 await drag(page,{x:b.x+b.width*.5,y:b.y+b.height*.5},{x:b.x+b.width*.7,y:b.y+b.height*.6})
 await expect(page.getByLabel('Surface',{exact:true})).toHaveValue(face)
 await page.screenshot({path:'test-results/ship-painted-exterior.png'})
 for(const width of [1024,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 expect(api.stats.saves).toBe(0);expect(JSON.stringify(api.ships.get(shipId)!.plan)).toBe(original);expect(errors).toBe(0)
})

test('large surface fill is bounded and keyboard multiselect paints only selected foot squares',async({page})=>{
 const api=await backend(page),plan=api.ships.get(shipId)!.plan,d=plan.decks[0]
 d.width=100;d.height=100;d.rooms=[{id:'large-room',name:'Large room',x:0,y:0,width:100,height:100,notes:''}];plan.parts=[];plan.connections=[]
 await page.goto(`/v2/ships/${shipId}`);await page.locator('[data-kind="room"][data-id="large-room"]').first().click()
 await page.getByRole('button',{name:'Fill surface',exact:true}).click();await expect(page.getByText('Select a smaller area before filling this surface.',{exact:true})).toBeVisible()
 await expect(page.getByText('All changes saved',{exact:false})).toBeVisible()
 for(const [x,y] of [[1,1],[4,4]]){await page.getByLabel('Square x',{exact:true}).fill(String(x));await page.getByLabel('Square y',{exact:true}).fill(String(y));await page.getByRole('button',{name:'Add square to selection',exact:true}).click()}
 await expect(page.getByText('2 selected',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Fill selection',exact:true}).click();await page.getByRole('button',{name:'Save ship',exact:true}).click()
 await expect(page.getByText('All changes saved',{exact:false})).toBeVisible()
 expect(api.ships.get(shipId)!.plan.surface_design!.surfaces[0].paint.runs.reduce((n,r)=>n+r[1],0)).toBe(2)
})


test('large Paint preserves sized strokes across views, undo, pan, cancellation and reload',async({page})=>{
 const api=await backend(page);await page.setViewportSize({width:1366,height:900});await page.goto(`/v2/ships/${shipId}`)
 await page.getByRole('button',{name:'Paint',exact:true}).click()
 const canvas=page.getByTestId('surface-paint-canvas');await expect(canvas).toBeVisible();expect((await canvas.boundingBox())!.width).toBeGreaterThan(1000)
 await page.getByLabel('Brush size').fill('5')
 const deck=api.ships.get(shipId)!.plan.decks[0],r=deck.rooms[0]
 async function point(x:number,y:number){const b=(await canvas.boundingBox())!,w=Math.max(...deck.rooms.map(r=>(r.x+r.width)*5)),h=Math.max(...deck.rooms.map(r=>(r.y+r.height)*5)),scale=Math.min(1160/w,580/h);return{x:b.x+(20+(x+.5)*scale)*b.width/1200,y:b.y+(20+(y+.5)*scale)*b.height/620}}
 let at=await point(r.x*5+5,r.y*5+5);await page.mouse.move(at.x,at.y);await page.screenshot({path:'test-results/ship-large-paint.png',fullPage:true});await page.mouse.click(at.x,at.y)
 await expect(page.getByRole('button',{name:'Undo map edit'})).toBeEnabled()
 for(const view of ['Walkthrough','Cutaway','Paint','2D','Paint']){await page.getByRole('button',{name:view,exact:true}).click();if(view==='Walkthrough'){await expect(page.getByTestId('ship-walk-canvas')).toHaveAttribute('data-position',/./);await page.screenshot({path:'test-results/ship-walkthrough-freighter.png',fullPage:true})}}
 await page.getByLabel('Current deck').selectOption(api.ships.get(shipId)!.plan.decks[1].id);await page.getByLabel('Current deck').selectOption(deck.id)
 await page.getByRole('button',{name:'Undo map edit'}).click();await expect(page.getByRole('button',{name:'Undo map edit'})).toBeDisabled();await page.getByRole('button',{name:'Redo map edit'}).click()
 await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible()
 const saved=structuredClone(api.ships.get(shipId)!.plan),floor=saved.surface_design!.surfaces.find(s=>s.room_id===r.id&&s.face==='floor')!
 expect(floor.paint.runs.reduce((n,r)=>n+r[1],0)).toBe(25)
 await page.getByLabel('Brush size').fill('3');await page.getByRole('button',{name:'erase',exact:true}).click();at=await point(r.x*5+5,r.y*5+5);await page.mouse.click(at.x,at.y);await page.getByRole('button',{name:'Undo map edit'}).click();await expect(page.getByRole('button',{name:'Redo map edit'})).toBeEnabled()
 await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled();expect(api.ships.get(shipId)!.plan).toEqual(saved)

 await page.getByRole('button',{name:'pan',exact:true}).click();at=await point(r.x*5+5,r.y*5+5);await drag(page,at,{x:at.x+100,y:at.y+30});await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Fit surface'}).click();await page.getByRole('button',{name:'brush',exact:true}).click();await page.mouse.move(at.x+100,at.y);await page.mouse.down();await page.keyboard.press('Escape');await page.mouse.up();await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled()
 await page.reload();await page.getByRole('button',{name:'Paint',exact:true}).click();await expect(canvas).toBeVisible();expect(api.ships.get(shipId)!.plan).toEqual(saved)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366)
})

test('Walkthrough stops at walls, transfers only along real ladders and releases controls',async({page})=>{
 const api=await backend(page,'player'),ship=api.ships.get(shipId)!,d=ship.plan.decks[0],other=ship.plan.decks[1]
 d.rooms=[{...d.rooms[0],x:2,y:2,width:4,height:4}];d.marks=[];other.rooms=[{...other.rooms[0],x:2,y:2,width:4,height:4}];other.marks=[];ship.plan.parts=[]
 ship.plan.connections=[{...ship.plan.connections[0],from_deck:d.id,to_deck:other.id,from:{x:3,y:3},to:{x:3,y:3}}]
 await page.setViewportSize({width:1366,height:900});await page.goto(`/v2/ships/${shipId}`);await page.getByRole('button',{name:'Walkthrough',exact:true}).click();const canvas=page.getByTestId('ship-walk-canvas');await expect(canvas).toBeVisible()
 const position=()=>canvas.getAttribute('data-position')
 await page.getByRole('button',{name:'Enter walkthrough',exact:true}).click();const start=await position();await page.keyboard.down('w');await page.waitForTimeout(1700);await page.keyboard.up('w');const wall=(await position())!.split(',').map(Number);expect(wall[1]).toBeGreaterThanOrEqual(2.2);expect(wall[1]).toBeLessThan(2.4)
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Enter walkthrough',exact:true})).toBeVisible();const stopped=await position();await page.keyboard.down('s');await page.waitForTimeout(150);await page.keyboard.up('s');expect(await position()).toBe(stopped);expect(stopped).not.toBe(start)
 await page.getByRole('button',{name:'Use ladder:',exact:false}).click();await expect(page.getByLabel('Current deck')).toHaveValue(other.id);await expect(canvas).toHaveAttribute('data-position','3.500,3.500')
 await page.getByRole('button',{name:'Use ladder:',exact:false}).click();await expect(page.getByLabel('Current deck')).toHaveValue(d.id)
 await page.getByRole('button',{name:'Enter walkthrough',exact:true}).click();const b=(await canvas.boundingBox())!;await drag(page,{x:b.x+b.width/2,y:b.y+b.height/2},{x:b.x+b.width/2+130,y:b.y+b.height/2});await page.screenshot({path:'test-results/ship-walkthrough.png',fullPage:true})
 await page.getByRole('button',{name:'2D',exact:true}).click();await page.getByRole('button',{name:'Walkthrough',exact:true}).click();await expect(page.getByRole('button',{name:'Enter walkthrough',exact:true})).toBeVisible();expect(api.stats.saves).toBe(0);expect(api.stats.notesReads).toBe(0)
 await page.getByRole('button',{name:'Paint',exact:true}).click();await expect(page.getByRole('button',{name:'brush',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Fill surface',exact:true})).toBeDisabled()
})

test('invalid ladder landing stays on source deck with a useful message',async({page})=>{
 const api=await backend(page,'player'),ship=api.ships.get(shipId)!,d=ship.plan.decks[0],r=d.rooms[0];ship.plan.connections[0].from={x:r.x+Math.floor(r.width/2),y:r.y+Math.floor(r.height/2)};ship.plan.connections[0].to={x:0,y:0}
 await page.goto(`/v2/ships/${shipId}`);await page.getByRole('button',{name:'Walkthrough',exact:true}).click();await expect(page.getByTestId('ship-walk-canvas')).toBeVisible();await page.getByRole('button',{name:'Use ladder:',exact:false}).click();await expect(page.getByText('This ladder has no safe connected landing.',{exact:false})).toBeVisible();await expect(page.getByLabel('Current deck')).toHaveValue(d.id);expect(api.stats.saves).toBe(0)
})


test('clicking a visible ladder mesh reaches its actual connected deck',async({page})=>{
 const api=await backend(page,'player'),ship=api.ships.get(shipId)!,d=ship.plan.decks[0],other=ship.plan.decks[1]
 d.rooms=[{...d.rooms[0],x:2,y:2,width:4,height:4}];d.marks=[];other.rooms=[{...other.rooms[0],x:2,y:2,width:4,height:4}];other.marks=[];ship.plan.parts=[]
 ship.plan.connections=[{...ship.plan.connections[0],from_deck:d.id,to_deck:other.id,from:{x:3,y:2},to:{x:3,y:3}}]
 await page.goto(`/v2/ships/${shipId}`);await page.getByRole('button',{name:'Walkthrough',exact:true}).click();const canvas=page.getByTestId('ship-walk-canvas');await expect(canvas).toHaveAttribute('data-position','4.000,4.000')
 await page.screenshot({path:'test-results/ship-ladder.png',fullPage:true})
 const b=(await canvas.boundingBox())!,tan=Math.tan(75*Math.PI/360),nx=(-.5/1.35)/(tan*b.width/b.height),ny=(-.95/1.35)/tan
 await canvas.click({position:{x:(nx+1)*b.width/2,y:(1-ny)*b.height/2}});await expect(page.getByLabel('Current deck')).toHaveValue(other.id)
 await page.getByRole('button',{name:'Enter walkthrough',exact:true}).click();await page.getByRole('button',{name:'Lock mouse',exact:true}).click();await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(true);await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(false)
 expect(api.stats.saves).toBe(0)
})


test('explicit ladder retains active controls and pointer lock across eight deck transfers; Escape still exits',async({page})=>{
 const api=await backend(page,'player'),ship=api.ships.get(shipId)!,d=ship.plan.decks[0],other=ship.plan.decks[1]
 for(const deck of [d,other]){deck.rooms=[{...deck.rooms[0],x:2,y:2,width:5,height:5}];deck.marks=[]}ship.plan.parts=[{id:'continuous-ladder',name:'Ladder',type:'Ladder',deck_id:d.id,room_id:d.rooms[0].id,x:3,y:3,quantity:1,quality:'Store-bought',black_market:false,condition:'Working',notes:''}]
 ship.plan.connections=[{...ship.plan.connections[0],from_deck:d.id,to_deck:other.id,from:{x:3,y:3},to:{x:3,y:3},aperture:{width:1,height:1,ladder_part_id:'continuous-ladder'}}]
 await page.goto(`/v2/ships/${shipId}`);await page.getByRole('button',{name:'Walkthrough',exact:true}).click();const canvas=page.getByTestId('ship-walk-canvas');await expect(canvas).toHaveAttribute('data-position',/./)
 await canvas.evaluate(el=>el.setAttribute('data-original-canvas','yes'));await page.getByRole('button',{name:'Enter walkthrough',exact:true}).click();await page.getByRole('button',{name:'Lock mouse',exact:true}).click();await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(true)
 for(let i=0;i<8;i++){await page.getByRole('button',{name:'Use ladder:',exact:false}).evaluate((el:HTMLButtonElement)=>el.click());await expect(page.getByLabel('Current deck')).toHaveValue(i%2===0?other.id:d.id);await expect(page.getByRole('button',{name:'Exit walkthrough',exact:true})).toBeVisible();await expect(canvas).toHaveAttribute('data-original-canvas','yes');expect(await canvas.evaluate(el=>document.pointerLockElement===el)).toBe(true)}
 const before=await canvas.getAttribute('data-position');await page.keyboard.down('s');await page.waitForTimeout(250);await page.keyboard.up('s');expect(await canvas.getAttribute('data-position')).not.toBe(before)
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Enter walkthrough',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.pointerLockElement)).toBe(null);expect(api.stats.saves).toBe(0)
})

test('dedicated Paint targets walls ceilings roofs and exterior sections with shared undo and persistence',async({page})=>{
 const api=await backend(page),ship=api.ships.get(shipId)!,room=ship.plan.decks[0].rooms[0];await page.goto(`/v2/ships/${shipId}`);await page.getByRole('button',{name:'Paint',exact:true}).click();await page.getByLabel('Paint target',{exact:true}).selectOption(room.id)
 for(const face of ['interior-front','ceiling','roof','exterior-front']){await page.getByLabel('Paint face',{exact:true}).selectOption(face);await expect(page.getByTestId('surface-paint-canvas')).toBeVisible();await page.getByRole('button',{name:'Fill surface',exact:true}).click()}
 await page.getByRole('button',{name:'Undo map edit'}).click();await page.getByRole('button',{name:'Redo map edit'}).click();await page.screenshot({path:'test-results/ship-paint-face.png',fullPage:true})
 for(const view of ['Walkthrough','Exterior','Paint'])await page.getByRole('button',{name:view,exact:true}).click();await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible()
 expect(ship.plan.surface_design).toBeUndefined();const surfaces=api.ships.get(shipId)!.plan.surface_design!.surfaces;expect(surfaces.map(s=>s.face).sort()).toEqual(['ceiling','exterior-front','interior-front','roof']);expect(surfaces.every(s=>s.paint.runs.length>0)).toBe(true)
 await page.reload();await page.getByRole('button',{name:'Paint',exact:true}).click();await page.getByLabel('Paint target',{exact:true}).selectOption(room.id);await page.getByLabel('Paint face',{exact:true}).selectOption('ceiling');await expect(page.getByTestId('surface-paint-canvas')).toBeVisible()
})

test('opening dimensions and separate ladder fixture save, hole-only has no traversal and readonly remains locked',async({page})=>{
 const api=await backend(page),ship=api.ships.get(shipId)!,c=ship.plan.connections[0];await page.goto(`/v2/ships/${shipId}`);await page.locator(`[data-kind="connection"][data-id="${c.id}"]`).click()
 await page.getByRole('button',{name:'Configure opening and ladder',exact:true}).click();await page.getByLabel('Opening width',{exact:true}).fill('2');await page.getByLabel('Opening height',{exact:true}).fill('2');await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible()
 let saved=api.ships.get(shipId)!;expect(saved.plan.connections[0].aperture).toMatchObject({width:2,height:2});expect(saved.plan.parts.find(p=>p.id===saved.plan.connections[0].aperture!.ladder_part_id)?.type).toBe('Ladder')
 await page.getByRole('button',{name:'Inventory',exact:true}).click();await page.getByRole('button',{name:/Cargo lift ladder/}).click();await expect(page.getByLabel('Type',{exact:true})).toBeDisabled();await expect(page.getByLabel('Quantity',{exact:true})).toBeDisabled();await expect(page.getByLabel('Component deck',{exact:true})).toBeDisabled();await page.locator(`[data-kind="connection"][data-id="${c.id}"]`).click()
 await page.getByLabel('Opening has ladder',{exact:true}).uncheck();await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible();saved=api.ships.get(shipId)!;expect(saved.plan.connections[0].aperture!.ladder_part_id).toBe(null)
 await page.getByRole('button',{name:'Walkthrough',exact:true}).click();await expect(page.getByRole('button',{name:'Use ladder:',exact:false})).toHaveCount(0);await page.getByLabel('Current deck').selectOption(saved.plan.decks[1].id);await page.getByRole('button',{name:'Enter walkthrough',exact:true}).click();const canvas=page.getByTestId('ship-walk-canvas');await expect(canvas).toBeVisible();await page.screenshot({path:'test-results/ship-open-hold.png',fullPage:true})
 await page.getByRole('button',{name:'2D',exact:true}).click();await page.getByRole('button',{name:'Add opening',exact:true}).click();await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible();expect(api.ships.get(shipId)!.plan.connections).toHaveLength(2)
})


test('connected opening visibly reveals the next deck without opaque caps and remains readonly',async({page})=>{
 const api=await backend(page,'player'),ship=api.ships.get(shipId)!,upper=ship.plan.decks[0],lower=ship.plan.decks[1]
 for(const d of [upper,lower]){d.rooms=[{...d.rooms[0],x:2,y:2,width:6,height:6}];d.marks=[]}ship.plan.parts=[];ship.plan.connections=[{...ship.plan.connections[0],from:{x:3,y:3},to:{x:3,y:3},aperture:{width:2,height:2,ladder_part_id:null}}]
 ship.plan.surface_design={surfaces:[{id:'ceiling-look',deck_id:upper.id,room_id:upper.rooms[0].id,face:'ceiling',color:'#d28a38',paint:{palette:[],runs:[]}}],sections:[],components:[]}
 let errors=0;page.on('pageerror',()=>errors++);await page.setViewportSize({width:1366,height:900});await page.goto(`/v2/ships/${shipId}`);await page.getByLabel('Current deck').selectOption(lower.id);await page.getByRole('button',{name:'Walkthrough',exact:true}).click();const canvas=page.getByTestId('ship-walk-canvas');await expect(canvas).toHaveAttribute('data-position','5.000,5.000');await page.getByRole('button',{name:'Enter walkthrough',exact:true}).click()
 const b=(await canvas.boundingBox())!;await drag(page,{x:b.x+b.width/2,y:b.y+b.height/2},{x:b.x+b.width/2-157,y:b.y+b.height/2-90});await page.screenshot({path:'test-results/ship-through-opening.png',fullPage:true})
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Paint',exact:true}).click();await page.getByLabel('Paint target',{exact:true}).selectOption(lower.rooms[0].id);await page.getByLabel('Paint face',{exact:true}).selectOption('ceiling');await expect(page.getByRole('button',{name:'Fill surface',exact:true})).toBeDisabled();expect(api.stats.saves).toBe(0);expect(errors).toBe(0)
})


test('Move snaps rooms openings and fixtures, carries attachments, rejects invalid drops and cancels safely',async({page})=>{
 const api=await backend(page),ship=api.ships.get(shipId)!,a=ship.plan.decks[0],b=ship.plan.decks[1]
 for(const d of [a,b]){d.rooms=[{...d.rooms[0],x:4,y:4,width:8,height:8}];d.marks=[]}
 ship.plan.parts=[{...ship.plan.parts[0],id:'move-ladder',type:'Ladder',deck_id:a.id,room_id:a.rooms[0].id,x:6,y:6,quantity:1},{...ship.plan.parts[0],id:'move-bed',type:'Bed',deck_id:a.id,room_id:a.rooms[0].id,x:5,y:5}]
 ship.plan.connections=[{...ship.plan.connections[0],from:{x:6,y:6},to:{x:6,y:6},aperture:{width:1,height:1,ladder_part_id:'move-ladder'}}]
 await page.goto(`/v2/ships/${shipId}`);await page.getByRole('button',{name:'Move',exact:true}).click()
 await drag(page,await cell(page,4,4),await cell(page,5,4));await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible()
 let saved=api.ships.get(shipId)!;expect(saved.plan.decks[0].rooms[0].x).toBe(5);expect(saved.plan.parts.find(p=>p.id==='move-bed')!.x).toBe(6);expect(saved.plan.connections[0].from.x).toBe(7);expect(saved.plan.connections[0].to.x).toBe(7)
 await drag(page,await cell(page,7,6),await cell(page,8,6));await page.getByRole('button',{name:'Undo map edit'}).click();await page.getByRole('button',{name:'Redo map edit'}).click()
 await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible();saved=api.ships.get(shipId)!;expect(saved.plan.parts.find(p=>p.id==='move-ladder')!.x).toBe(8);expect(saved.plan.connections[0].to.x).toBe(8)
 for(const cancel of ['Escape','pointercancel']){const from=await cell(page,8,6),to=await cell(page,9,6);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y);if(cancel==='Escape')await page.keyboard.press('Escape');else await page.getByTestId('ship-grid').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled()}
 await drag(page,await cell(page,8,6),await cell(page,0,0));await expect(page.getByText('Openings must join adjacent decks, fit room floors at both ends, and align with other openings between those decks.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled()
 await drag(page,await cell(page,6,5),await cell(page,7,5));await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible();expect(api.ships.get(shipId)!.plan.parts.find(p=>p.id==='move-bed')!.x).toBe(7)
 await page.reload();await expect(page.locator('[data-kind="part"][data-id="move-bed"]')).toBeVisible()
})

async function exteriorSpot(page:Page,face:string){
 const canvas=page.getByTestId('ship-3d-canvas');await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!
 for(const y of [.5,.4,.6,.3,.7,.8,.9])for(const x of [.5,.4,.6,.3,.7]){const p={x:b.x+b.width*x,y:b.y+b.height*y};await page.mouse.move(p.x,p.y);if(await canvas.getAttribute('data-paint-face')===face&&Number(await canvas.getAttribute('data-brush-tiles'))>0)return p}
 throw new Error(`No visible paint footprint for ${face}`)
}
test('direct exterior and underside strokes stay separate, cancel, undo redo and reload without camera edits',async({page})=>{
 const api=await backend(page),ship=api.ships.get(shipId)!,d=ship.plan.decks[0];ship.plan.decks=[d];d.rooms=[{...d.rooms[0],x:4,y:4,width:6,height:6}];d.marks=[];ship.plan.parts=[];ship.plan.connections=[]
 await page.setViewportSize({width:1366,height:900});await page.goto(`/v2/ships/${shipId}`);await page.getByRole('button',{name:'Exterior',exact:true}).click();await expect(page.getByTestId('ship-3d-canvas')).toBeVisible()
 await page.getByRole('button',{name:'View underside',exact:true}).click();await expect.poll(async()=>Number(await page.getByTestId('ship-3d-canvas').getAttribute('data-camera-y'))).toBeLessThan(0)
 await page.getByRole('button',{name:'Paint exterior',exact:true}).click();await page.getByLabel('Exterior brush size').fill('3');await page.getByLabel('Exterior paint color').fill('#ff0000')
 let at=await exteriorSpot(page,'underside');await page.mouse.down();await page.keyboard.press('Escape');await page.mouse.up();await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled()
 at=await exteriorSpot(page,'underside');await page.mouse.click(at.x,at.y);await page.getByRole('button',{name:'Undo map edit'}).click();await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Redo map edit'}).click()
 await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible();let surfaces=api.ships.get(shipId)!.plan.surface_design!.surfaces;expect(surfaces.find(s=>s.face==='underside')!.paint.runs.length).toBeGreaterThan(0);expect(surfaces.some(s=>s.face==='floor')).toBe(false)
 await page.screenshot({path:'test-results/ship-underside-brush.png',fullPage:true})
 await page.getByRole('button',{name:'Orbit',exact:true}).click();await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.getByRole('button',{name:'Paint exterior',exact:true}).click();at=await exteriorSpot(page,'roof');await page.mouse.click(at.x,at.y)
 await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible();surfaces=api.ships.get(shipId)!.plan.surface_design!.surfaces;expect(surfaces.map(s=>s.face).sort()).toEqual(['roof','underside'])
 await page.reload();await page.getByRole('button',{name:'Exterior',exact:true}).click();await page.getByRole('button',{name:'View underside',exact:true}).click();await page.getByRole('button',{name:'Erase exterior',exact:true}).click();await page.getByLabel('Exterior brush size').fill('3');at=await exteriorSpot(page,'underside');await page.mouse.click(at.x,at.y);await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible();expect(api.ships.get(shipId)!.plan.surface_design!.surfaces.find(s=>s.face==='underside')!.paint.runs).toEqual([])
})
test('read-only exterior can orbit below but cannot paint or move',async({page})=>{
 await backend(page,'player');await page.goto(`/v2/ships/${shipId}`);await expect(page.getByRole('button',{name:'Move',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Exterior',exact:true}).click();await page.getByRole('button',{name:'View underside',exact:true}).click();await expect.poll(async()=>Number(await page.getByTestId('ship-3d-canvas').getAttribute('data-camera-y'))).toBeLessThan(0);await expect(page.getByRole('button',{name:'Paint exterior',exact:true})).toHaveCount(0)
})


test('sloped exterior paint stays on its visible face and absent underside support fails closed',async({page})=>{
 const api=await backend(page),ship=api.ships.get(shipId)!,d=ship.plan.decks[0];ship.plan.decks=[d];d.rooms=[{...d.rooms[0],x:4,y:4,width:6,height:6}];d.marks=[];ship.plan.parts=[];ship.plan.connections=[]
 ship.plan.surface_design={surfaces:[],components:[],sections:[{id:'rear-shape',deck_id:d.id,room_id:d.rooms[0].id,side:'rear',extension_ft:5,slope:.8,taper:.3,bevel_ft:1}]}
 await page.route('**/rest/v1/rpc/v2_ship_check_surfaces',r=>r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Invalid painted face'})}))
 await page.goto(`/v2/ships/${shipId}`);await page.getByRole('button',{name:'Exterior',exact:true}).click();await page.getByRole('button',{name:'Paint exterior',exact:true}).click();const at=await exteriorSpot(page,'exterior-rear');await page.mouse.click(at.x,at.y);await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible();expect(api.ships.get(shipId)!.plan.surface_design!.surfaces.map(s=>s.face)).toEqual(['exterior-rear'])
 await page.getByRole('button',{name:'View underside',exact:true}).click();const canvas=page.getByTestId('ship-3d-canvas');await expect.poll(async()=>Number(await canvas.getAttribute('data-camera-y'))).toBeLessThan(0);await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!;await canvas.click({position:{x:b.width/2,y:b.height/2}});await expect(page.getByText('Underside painting needs the reviewed underside migration. Other exterior faces remain available.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled()
 await page.getByLabel('Transparent hull',{exact:true}).check();await expect(page.getByRole('button',{name:'Paint exterior',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled()
})


test('live exterior stripe crosses adjoining rooms before release with one undo and multiroom eraser',async({page})=>{
 test.setTimeout(180000)
 const api=await backend(page),ship=api.ships.get(shipId)!,d=ship.plan.decks[0]
 ship.plan.decks=[d];d.rooms=Array.from({length:3},(_,i)=>({...d.rooms[0],id:`stripe-room-${i}`,name:['Cockpit','Cabin','Engineering'][i],x:4,y:3+i*4,width:6,height:4}));d.marks=[];ship.plan.parts=[];ship.plan.connections=[]
 await page.setViewportSize({width:1366,height:900});await page.goto(`/v2/ships/${shipId}`);await page.getByRole('button',{name:'Exterior',exact:true}).click();await page.getByRole('button',{name:'Paint exterior',exact:true}).click();await page.getByLabel('Exterior paint color').fill('#ff0000');await page.getByLabel('Exterior brush size').fill('3')
 const canvas=page.getByTestId('ship-3d-canvas')
 async function spots(face:string){
  await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!,found=new Map<string,{x:number;y:number}[]>()
  for(let y=.15;y<=.9;y+=.075)for(let x=.15;x<=.85;x+=.075){const p={x:b.x+b.width*x,y:b.y+b.height*y};await page.mouse.move(p.x,p.y);if(await canvas.getAttribute('data-paint-face')===face){const id=await canvas.getAttribute('data-paint-room');if(id){const points=found.get(id)??[];points.push(p);found.set(id,points)}}}
  return d.rooms.map(r=>{const points=found.get(r.id);expect(points?.length,`${face} ${r.name} visible`).toBeGreaterThan(0);return points!.reduce((a,p)=>({x:a.x+p.x/points!.length,y:a.y+p.y/points!.length}),{x:0,y:0})})
 }
 let points=await spots('roof');await page.mouse.move(points[0].x,points[0].y);const before=await canvas.screenshot();await page.mouse.down()
 // A single fast event for each room exercises interpolation rather than many test-generated events.
 for(const p of points.slice(1))await page.mouse.move(p.x,p.y)
 await expect.poll(async()=>Number(await canvas.getAttribute('data-live-paint-tiles'))).toBeGreaterThan(30)
 expect((await canvas.screenshot()).equals(before)).toBe(false);await page.screenshot({path:'test-results/ship-live-multiroom-stripe.png',fullPage:true})
 expect(api.stats.saves).toBe(0);await page.mouse.up();await page.getByRole('button',{name:'Undo map edit'}).click();await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Redo map edit'}).click()
 await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible()
 let surfaces=api.ships.get(shipId)!.plan.surface_design!.surfaces;expect(surfaces.map(s=>s.room_id).sort()).toEqual(d.rooms.map(r=>r.id).sort());expect(surfaces.every(s=>s.face==='roof'&&s.paint.palette.includes('#ff0000')&&s.paint.runs.length)).toBe(true)
 const saved=JSON.stringify(surfaces);await page.reload();await page.getByRole('button',{name:'Exterior',exact:true}).click();await page.getByRole('button',{name:'Erase exterior',exact:true}).click();await page.getByLabel('Exterior brush size').fill('3');points=await spots('roof')
 for(const cancel of ['Escape','pointercancel','pointerleave','tool']){
  await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(p.x,p.y)
  if(cancel==='Escape')await page.keyboard.press('Escape');else if(cancel==='tool')await page.getByRole('button',{name:'Orbit',exact:true}).evaluate((el:HTMLButtonElement)=>el.click());else await canvas.dispatchEvent(cancel,{pointerId:1})
  await page.mouse.up();await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled();expect(JSON.stringify(api.ships.get(shipId)!.plan.surface_design!.surfaces)).toBe(saved)
  if(cancel==='tool')await page.getByRole('button',{name:'Erase exterior',exact:true}).click()
 }
 await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(p.x,p.y);await page.mouse.up();await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible();surfaces=api.ships.get(shipId)!.plan.surface_design!.surfaces;expect(surfaces.every(s=>s.paint.runs.length===0)).toBe(true)
 await page.getByRole('button',{name:'View underside',exact:true}).click();await expect.poll(async()=>Number(await canvas.getAttribute('data-camera-y'))).toBeLessThan(0);await page.getByRole('button',{name:'Paint exterior',exact:true}).click();points=await spots('underside')
 await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(p.x,p.y);await expect.poll(async()=>Number(await canvas.getAttribute('data-live-paint-tiles'))).toBeGreaterThan(30);await page.mouse.up();await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible();expect(api.ships.get(shipId)!.plan.surface_design!.surfaces.filter(s=>s.face==='underside')).toHaveLength(3)
 await page.getByRole('button',{name:'Reset view',exact:true}).click();points=await spots('exterior-starboard')
 await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(p.x,p.y);await expect.poll(async()=>Number(await canvas.getAttribute('data-live-paint-tiles'))).toBeGreaterThan(30);await page.mouse.up();await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible();expect(api.ships.get(shipId)!.plan.surface_design!.surfaces.filter(s=>s.face==='exterior-starboard')).toHaveLength(3)

})


test('one live shaped-hull stripe crosses decks and wraps wall roof opposite wall with paused orbit',async({page})=>{
 test.setTimeout(120000)
 const api=await backend(page),ship=api.ships.get(shipId)!,[upper,lower]=ship.plan.decks
 ship.plan.parts=[];ship.plan.connections=[]
 for(const [i,d] of [upper,lower].entries()){d.height_ft=10;d.rooms=[{...d.rooms[0],id:`wrap-room-${i}`,x:4,y:4,width:6,height:8}];d.marks=[]}
 // Matching shaped sides meet through their physical seam caps and the deck ledges.
 ship.plan.surface_design={surfaces:[],components:[],sections:[upper,lower].flatMap(d=>['front','rear','port','starboard'].map(side=>({id:`${d.id}-${side}`,deck_id:d.id,room_id:d.rooms[0].id,side:side as 'front'|'rear'|'port'|'starboard',extension_ft:side==='port'||side==='starboard'?2:0,slope:.5,taper:side==='port'||side==='starboard'?.2:0,bevel_ft:0})))}
 const model=createSurfaceMeshes(ship.plan,{deckId:upper.id,mode:'exterior',roofs:true,allDecks:true,separated:false,forceSurfaces:true},false)
 const canvas=page.getByTestId('ship-3d-canvas')
 async function spot(deckId:string,face:string,cap?:string){
  await canvas.scrollIntoViewIfNeeded();const box=(await canvas.boundingBox())!,camera=new THREE.PerspectiveCamera(38,box.width/box.height,.1,2000)
  camera.position.fromArray((await canvas.getAttribute('data-camera-position'))!.split(',').map(Number));camera.lookAt(new THREE.Vector3().fromArray((await canvas.getAttribute('data-camera-target'))!.split(',').map(Number)));camera.updateMatrixWorld()
  const mesh=model.meshes.find(m=>m.userData.deckId===deckId&&m.userData.face===face&&(cap?m.userData.surface.capSide===cap:!m.userData.surface.cap))!,v=new THREE.Vector3(),position=mesh.geometry.getAttribute('position')
  for(let i=0;i<4;i++)v.add(new THREE.Vector3().fromBufferAttribute(position,i));v.multiplyScalar(.25).project(camera)
  return{x:box.x+(v.x+1)*box.width/2,y:box.y+(1-v.y)*box.height/2}
 }
 await page.setViewportSize({width:1366,height:1000});await page.goto(`/v2/ships/${shipId}`);await page.getByRole('button',{name:'Exterior',exact:true}).click();await page.getByRole('button',{name:'Paint exterior',exact:true}).click();await page.getByLabel('Exterior brush size').fill('3');await page.getByLabel('Exterior paint color').fill('#ff0000')
 let at=await spot(lower.id,'exterior-starboard');await page.mouse.move(at.x,at.y);const before=await canvas.screenshot();await page.mouse.down()
 for(const [deckId,face,cap] of [[lower.id,'exterior-starboard','top'],[upper.id,'exterior-starboard','bottom'],[upper.id,'exterior-starboard',''],[upper.id,'exterior-starboard','top'],[upper.id,'roof','']]){at=await spot(deckId,face,cap||undefined);await page.mouse.move(at.x,at.y,{steps:5})}
 await expect(canvas).toHaveAttribute('data-live-paint-surfaces',new RegExp(lower.id+'/exterior-starboard'));await expect(canvas).toHaveAttribute('data-live-paint-surfaces',new RegExp(upper.id+'/exterior-starboard'));await expect(canvas).toHaveAttribute('data-live-paint-surfaces',/roof/);expect((await canvas.getAttribute('data-live-paint-surfaces'))!).not.toContain('exterior-port')
 expect((await canvas.screenshot()).equals(before)).toBe(false);await page.screenshot({path:'test-results/ship-cross-deck-held.png',fullPage:true})
 const count=await canvas.getAttribute('data-live-paint-tiles'),cameraBefore=await canvas.getAttribute('data-camera-position')
 await page.keyboard.down('Alt');await page.mouse.move(at.x+400,at.y,{steps:10});await expect(canvas).toHaveAttribute('data-paint-orbit','true');expect(await canvas.getAttribute('data-camera-position')).not.toBe(cameraBefore);expect(await canvas.getAttribute('data-live-paint-tiles')).toBe(count);await page.mouse.up();await page.keyboard.up('Alt');await expect(canvas).toHaveAttribute('data-paint-paused','true');await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled();await page.waitForTimeout(50);at=await spot(upper.id,'roof');await page.mouse.move(at.x,at.y);expect(await canvas.getAttribute('data-live-paint-tiles')).toBe(count);await page.mouse.down()
 for(const [deckId,face,cap] of [[upper.id,'roof',''],[upper.id,'exterior-port','top'],[upper.id,'exterior-port',''],[upper.id,'exterior-port','bottom'],[lower.id,'exterior-port','top'],[lower.id,'exterior-port','']]){at=await spot(deckId,face,cap||undefined);await page.mouse.move(at.x,at.y,{steps:5})}
 await expect(canvas).toHaveAttribute('data-live-paint-surfaces',new RegExp(lower.id+'/exterior-port'));await page.screenshot({path:'test-results/ship-wrapped-held.png',fullPage:true});await page.mouse.up()
 await page.getByRole('button',{name:'Undo map edit'}).click();await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Redo map edit'}).click();await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible()
 const surfaces=api.ships.get(shipId)!.plan.surface_design!.surfaces
 for(const d of [upper,lower])for(const face of ['exterior-port','exterior-starboard'])expect(surfaces.some(s=>s.deck_id===d.id&&s.face===face&&s.paint.runs.length>0)).toBe(true)
 expect(surfaces.some(s=>s.face==='roof'&&s.paint.runs.length>0)).toBe(true);expect(surfaces.some(s=>s.paint.runs.some(r=>r[0]>=384*1024))).toBe(true)
 await page.reload();await page.getByRole('button',{name:'Exterior',exact:true}).click();await expect(canvas).toBeVisible();await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled();expect(api.stats.saves).toBe(1)
 await page.getByRole('button',{name:'Erase exterior',exact:true}).click();await page.getByLabel('Exterior brush size').fill('3')
 // A paused orbit can be canceled without committing the eraser preview.
 at=await spot(lower.id,'exterior-starboard');await page.mouse.move(at.x,at.y);await page.mouse.down();await page.keyboard.down('Alt');await page.mouse.move(at.x+10,at.y);await page.mouse.up();await page.keyboard.up('Alt');await expect(canvas).toHaveAttribute('data-paint-paused','true');await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeDisabled()
 at=await spot(lower.id,'exterior-starboard');await page.mouse.move(at.x,at.y);await page.mouse.down()
 for(const [deckId,cap] of [[lower.id,'top'],[upper.id,'bottom'],[upper.id,'']]){at=await spot(deckId,'exterior-starboard',cap||undefined);await page.mouse.move(at.x,at.y,{steps:5})}
 await page.keyboard.down('Alt');await page.mouse.up();await page.keyboard.up('Alt');await expect(canvas).toHaveAttribute('data-paint-paused','true');await page.keyboard.press('Enter')
 await page.getByRole('button',{name:'Save ship',exact:true}).click();await expect(page.getByText('Ship saved.',{exact:true})).toBeVisible()
 for(const d of [upper,lower]){const size=(rows:typeof surfaces)=>rows.find(s=>s.deck_id===d.id&&s.face==='exterior-starboard')!.paint.runs.reduce((n,r)=>n+r[1],0);expect(size(api.ships.get(shipId)!.plan.surface_design!.surfaces)).toBeLessThan(size(surfaces))}
 expect(api.stats.saves).toBe(2);model.dispose()
})
