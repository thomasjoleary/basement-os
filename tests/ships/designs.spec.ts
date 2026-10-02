import {test,expect,type Page} from '@playwright/test'
import {instantiateTemplate} from '../../lib/ship-templates'
import {type Design} from '../../lib/ship-designs'
const author='10000000-0000-0000-0000-000000000002',gm='10000000-0000-0000-0000-000000000001',id='20000000-0000-0000-0000-000000000001'
async function backend(page:Page,reviewer=false){
  const design:Design={id,author_id:author,name:'Private fighter',description:'',plan:instantiateTemplate('fighter'),status:reviewer?'submitted':'draft',version:1,current_submission:reviewer?1:null,accepted_ship_id:null,accepted_ship_version:null}
  const calls:string[]=[];let fail=false,privateReads=0
  await page.addInitScript(({user})=>localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:'local-test-token',refresh_token:'local-refresh',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:user,aud:'authenticated',role:'authenticated'}})),{user:reviewer?gm:author})
  await page.route('http://127.0.0.1:54321/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname
    const reply=(data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
    if(path.includes('v2_ship_gm_notes'))privateReads++
    if(path.endsWith('campaign_access_status'))return reply({status:'approved',is_gm:reviewer})
    if(path.includes('/profiles'))return reply(url.searchParams.get('select')==='role'?{role:reviewer?'gm':'player'}:[{id:author,username:'Pilot'},{id:gm,username:'GM'}])
    if(path.endsWith('v2_design_action')){
      const p=route.request().postDataJSON();calls.push(p.action)
      if(fail)return reply({message:'Design changed. Reload before continuing.',code:'40001'},409)
      if(p.action==='save'){design.name=p.payload.name;design.description=p.payload.description;design.plan=p.payload.plan}
      if(p.action==='submit'){design.status='submitted';design.current_submission=design.version+1}
      if(p.action==='withdraw'||p.action==='revise')design.status='draft'
      if(p.action==='request_changes')design.status='changes_requested'
      if(p.action==='accept'){design.status='accepted';design.accepted_ship_id='30000000-0000-0000-0000-000000000001';design.accepted_ship_version=1}
      design.version++;return reply(design)
    }
    if(path.endsWith('v2_ship_review_events'))return reply([{id:'event',version:design.version,submission_version:design.current_submission,action:design.status,feedback:'Review feedback',created_at:'2026-10-01T00:00:00Z'}])
    if(path.endsWith('v2_ship_designs'))return reply(url.searchParams.has('id')?design:[design])
    if(path.endsWith('v2_ship_submissions'))return reply(url.searchParams.has('version')?{...design,version:design.current_submission}:[{...design,version:design.current_submission}])
    return reply({})
  })
  return {design,calls,setFail:(value:boolean)=>{fail=value},notesReads:()=>privateReads}
}
test('author edits privately, saves before submission, withdraws and never requests GM notes',async({page})=>{
  const api=await backend(page);await page.goto(`/v2/designs/${id}`)
  await page.getByRole('button',{name:'Ship',exact:true}).click()
  await expect(page.getByLabel('GM-only notes')).toHaveCount(0)
  await page.getByLabel('Ship name').fill('My revised fighter')
  await expect(page.getByRole('button',{name:'Submit saved design'})).toBeDisabled()
  await page.getByRole('button',{name:'Save ship',exact:true}).click()
  await expect(page.getByRole('button',{name:'Submit saved design'})).toBeEnabled()
  await page.getByRole('button',{name:'Submit saved design'}).dblclick()
  await expect(page.getByRole('button',{name:'Withdraw to edit'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Save ship',exact:true})).toHaveCount(0)
  expect(api.calls.filter(x=>x==='submit')).toHaveLength(1)
  await page.getByRole('button',{name:'Withdraw to edit'}).click()
  await expect(page.getByRole('button',{name:'Save ship',exact:true})).toBeVisible()
  expect(api.design.name).toBe('My revised fighter');expect(api.notesReads()).toBe(0)
})
test('GM acceptance cancels cleanly, reports stale review and retries exact submission',async({page})=>{
  const api=await backend(page,true);await page.goto(`/v2/designs/${id}`)
  await expect(page.getByRole('button',{name:'Save ship',exact:true})).toHaveCount(0)
  await page.getByLabel('Playable owner').selectOption(author)
  page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Accept submission',exact:true}).click();expect(api.calls).toHaveLength(0)
  api.setFail(true);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Accept submission',exact:true}).click()
  await expect(page.getByRole('alert').filter({hasText:'Design changed'})).toContainText('Design changed')
  api.setFail(false);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Accept submission',exact:true}).click()
  await expect(page.getByRole('link',{name:'Open accepted playable version 1'})).toBeVisible()
  expect(api.design.status).toBe('accepted');expect(api.notesReads()).toBe(0)
  await page.getByRole('button',{name:'Paint',exact:true}).click();await expect(page.getByRole('button',{name:'brush',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Fill surface',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Walkthrough',exact:true}).click();await expect(page.getByTestId('ship-walk-canvas')).toBeVisible();await page.getByRole('button',{name:'Enter walkthrough',exact:true}).click();await page.keyboard.press('Escape');expect(api.calls.filter(c=>c==='save')).toHaveLength(0)

})
test('GM feedback requests changes without changing submitted plan',async({page})=>{
  const api=await backend(page,true),original=JSON.stringify(api.design.plan)
  await page.goto(`/v2/designs/${id}`);await page.getByLabel('Feedback',{exact:true}).fill('Please adjust the cockpit')
  await page.getByRole('button',{name:'Request changes',exact:true}).click()
  await expect(page.getByText('changes requested',{exact:true})).toBeVisible()
  expect(JSON.stringify(api.design.plan)).toBe(original)
})
