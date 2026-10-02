'use client'
import {use,useCallback,useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {supabase} from '@/lib/supabase'
import {shipAccess,type Profile} from '@/lib/ship-api'
import {type Ship} from '@/lib/ships'
import {type Design,type ReviewEvent,designAction,designError,designShip,submissionChanges} from '@/lib/ship-designs'
import ShipEditor from '@/components/ships/ShipEditor'
export default function DesignPage({params}:{params:Promise<{id:string}>}){
  const {id}=use(params),lock=useRef(false)
  const [design,setDesign]=useState<Design|null>(null),[events,setEvents]=useState<ReviewEvent[]>([]),[access,setAccess]=useState<{isGM:boolean;userId:string}|null>(null)
  const [profiles,setProfiles]=useState<Profile[]>([]),[owner,setOwner]=useState(''),[crew,setCrew]=useState<string[]>([]),[feedback,setFeedback]=useState('')
  const [changes,setChanges]=useState<string[]>([]),[comparison,setComparison]=useState('')
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[historical,setHistorical]=useState<Ship|null>(null)
  const load=useCallback(async()=>{
    const who=await shipAccess();if(!who)throw new Error('Sign in to view designs.')
    const [d,e]=await Promise.all([supabase.from('v2_ship_designs').select('*').eq('id',id).maybeSingle(),supabase.from('v2_ship_review_events').select('id,version,submission_version,action,feedback,actor_id,created_at').eq('design_id',id).order('version',{ascending:false})])
    if(d.error)throw new Error(designError(d.error));if(e.error)throw new Error(designError(e.error));if(!d.data)throw new Error('Design unavailable.')
    if(who.isGM){const p=await supabase.from('profiles').select('id,username').eq('approval_status','approved').order('username');if(p.error)throw new Error(p.error.message);setProfiles(p.data??[])}
    const submissions=await supabase.from('v2_ship_submissions').select('version,name,description,plan').eq('design_id',id).order('version',{ascending:false}).limit(2)
    if(submissions.error)throw new Error(designError(submissions.error))
    if(submissions.data?.length===2){setChanges(submissionChanges(submissions.data[1],submissions.data[0]));setComparison(`Submission ${submissions.data[1].version} → ${submissions.data[0].version}`)}else{setChanges([]);setComparison('First submission: no earlier submission to compare.')}
    if(who.isGM&&d.data.accepted_ship_id){const playable=await supabase.from('v2_ships').select('owner_id,crew_ids').eq('id',d.data.accepted_ship_id).maybeSingle();if(playable.error)throw new Error(playable.error.message);setOwner(playable.data?.owner_id??'');setCrew(playable.data?.crew_ids??[])}
    setAccess(who);setDesign(d.data as Design);setEvents(e.data??[]);setHistorical(null);setDirty(false)
  },[id])
  useEffect(()=>{void load().catch(e=>setError((e as Error).message))},[load])
  async function run(action:string){if(!design||lock.current||dirty)return;lock.current=true;setBusy(true);setError('');try{
    const payload=action==='accept'?{submission_version:design.current_submission,owner_id:owner||null,crew_ids:crew,feedback}:['feedback','request_changes'].includes(action)?{feedback}:{}
    await designAction(id,design.version,action,payload);setFeedback('');await load()
  }catch(e){setError((e as Error).message)}finally{lock.current=false;setBusy(false)}}
  async function save(ship:Ship){if(!design)throw new Error('Design unavailable');const next=await designAction(id,ship.version,'save',{name:ship.name,description:ship.description,plan:ship.plan});setDesign(next);setDirty(false);return designShip(next)}
  async function snapshot(version:number){if(dirty||lock.current)return;setError('');try{
    const {data,error}=await supabase.from('v2_ship_submissions').select('*').eq('design_id',id).eq('version',version).single()
    if(error)throw new Error(designError(error));setHistorical(designShip({...data,id}))
  }catch(e){setError((e as Error).message)}}
  const author=design?.author_id===access?.userId,editable=author&&['draft','changes_requested'].includes(design?.status??'')&&!historical
  return <div className="min-h-screen bg-gray-900 text-white"><section className="max-w-[1600px] mx-auto p-5 space-y-3">
    <Link href="/v2/designs" onClick={e=>{if(busy||(dirty&&!confirm('Leave without saving your changes?')))e.preventDefault()}}>Back to designs</Link>
    <h1 className="text-2xl font-bold">Design review</h1>{error&&<p role="alert" className="text-red-300">{error}</p>}
    {!design?(error?null:<p>Loading design…</p>):<><p>Status: <strong>{design.status.replaceAll('_',' ')}</strong> · Revision {design.version} · {author?'You are the author':'GM inspection'}</p>
    {design.accepted_ship_id&&<Link className="text-cyan-300 underline" href={`/v2/ships/${design.accepted_ship_id}`}>Open accepted playable version {design.accepted_ship_version}</Link>}
    {dirty&&<p role="status">Save or discard your editor changes before submitting or reviewing history.</p>}
    <fieldset disabled={busy||dirty} className="flex flex-wrap items-center gap-3 disabled:opacity-60">
      {author&&['draft','changes_requested'].includes(design.status)&&<button className="bg-cyan-800 p-2 rounded" onClick={()=>run('submit')}>Submit saved design</button>}
      {author&&design.status==='submitted'&&<button className="border border-gray-600 p-2 rounded" onClick={()=>run('withdraw')}>Withdraw to edit</button>}
      {author&&design.status==='accepted'&&<button className="bg-cyan-800 p-2 rounded" onClick={()=>run('revise')}>Start a new revision</button>}
      <button className="border border-gray-600 p-2 rounded" onClick={()=>{void load().catch(e=>setError((e as Error).message))}}>Refresh review</button>
    </fieldset>
    {access?.isGM&&design.status==='submitted'&&<fieldset disabled={busy||dirty||!!historical} className="border border-cyan-900 rounded p-4 space-y-3">
      <legend>Review submission {design.current_submission}</legend>
      <label className="block">Feedback<textarea className="block w-full bg-gray-950 p-2" maxLength={10000} value={feedback} onChange={e=>setFeedback(e.target.value)}/></label>
      <div className="flex flex-wrap gap-3"><button disabled={!feedback.trim()} className="border p-2 rounded disabled:opacity-40" onClick={()=>run('feedback')}>Send feedback</button><button disabled={!feedback.trim()} className="border p-2 rounded disabled:opacity-40" onClick={()=>run('request_changes')}>Request changes</button></div>
      <p className="text-sm text-gray-300">Acceptance publishes this exact submission. Confirm owner and crew; these assignments do not grant draft editing.</p>
      <label className="block">Playable owner<select className="block bg-gray-950 p-2" value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Unassigned</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.username}</option>)}</select></label>
      <fieldset><legend>Playable crew</legend><div className="flex flex-wrap gap-3">{profiles.map(p=><label key={p.id}><input type="checkbox" checked={crew.includes(p.id)} onChange={e=>setCrew(e.target.checked?[...crew,p.id]:crew.filter(x=>x!==p.id))}/> {p.username}</label>)}</div></fieldset>
      <button className="bg-cyan-800 p-2 rounded" onClick={()=>{if(confirm(`Accept submission ${design.current_submission} with these owner/crew assignments?`))void run('accept')}}>Accept submission</button>
    </fieldset>}
    <details><summary>Changes between submissions</summary><p>{comparison}</p>{changes.length?<ul className="list-disc pl-5">{changes.slice(0,100).map((change,i)=><li key={i}>{change}</li>)}</ul>:<p>No recorded differences.</p>}{changes.length>100&&<p>{changes.length-100} additional changes; inspect frozen submissions in review history.</p>}</details>
    <details><summary>Review history</summary><ol className="space-y-3 py-3">{events.map(e=><li key={e.id} className="border border-gray-700 rounded p-3"><p>Revision {e.version}: {e.action.replaceAll('_',' ')} · {e.actor_id===design.author_id?'Author':e.actor_id?'GM':'Removed account'} · {new Date(e.created_at).toLocaleString()}</p>{e.feedback&&<p className="whitespace-pre-wrap break-words mt-2">{e.feedback}</p>}{e.submission_version&&<button disabled={dirty||busy} className="text-cyan-300 underline" onClick={()=>snapshot(e.submission_version!)}>Inspect submission {e.submission_version}</button>}</li>)}</ol></details>
    {historical&&<p role="status">Inspecting frozen submission {historical.version}. <button className="underline" onClick={()=>setHistorical(null)}>Return to current design</button></p>}
    </>}
  </section>{design&&<ShipEditor key={`${design.id}:${design.version}:${historical?.version??'current'}`} initialShip={historical??designShip(design)} initialNotes="" isGM={false} canEdit={!!editable&&!busy} profiles={[]} designMode persist={save} onDirtyChange={setDirty} backHref="/v2/designs"/>}</div>
}
