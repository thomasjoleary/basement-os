'use client'
import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {supabase} from '@/lib/supabase'
import {shipAccess} from '@/lib/ship-api'
import {emptyPlan,newId} from '@/lib/ships'
import {instantiateTemplate,SHIP_TEMPLATES} from '@/lib/ship-templates'
import {type Design,designAction,designError} from '@/lib/ship-designs'
export default function DesignsPage(){
  const router=useRouter(),lock=useRef(false)
  const [rows,setRows]=useState<Pick<Design,'id'|'author_id'|'name'|'status'|'version'>[]>([]),[user,setUser]=useState(''),[gm,setGM]=useState(false),[loaded,setLoaded]=useState(false)
  const [error,setError]=useState(''),[name,setName]=useState(''),[template,setTemplate]=useState('fighter'),[busy,setBusy]=useState(false),[creating,setCreating]=useState(false)
  useEffect(()=>{let active=true;(async()=>{try{
    const access=await shipAccess();if(!access){router.replace('/login');return}
    const {data,error}=await supabase.from('v2_ship_designs').select('id,author_id,name,status,version,updated_at').order('updated_at',{ascending:false})
    if(error)throw new Error(designError(error))
    if(active){setRows(data);setUser(access.userId);setGM(access.isGM)}
  }catch(e){if(active)setError((e as Error).message)}finally{if(active)setLoaded(true)}})();return()=>{active=false}},[router])
  async function create(e:React.FormEvent){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
    const d=await designAction(newId(),0,'create',{name,description:'',plan:template==='blank'?emptyPlan():instantiateTemplate(template)})
    router.push(`/v2/designs/${d.id}`)
  }catch(e){setError((e as Error).message);lock.current=false;setBusy(false)}}
  return <main className="min-h-screen bg-gray-900 text-white p-5"><div className="max-w-5xl mx-auto space-y-5">
    <Link href="/v2/ships">Back to playable ships</Link><h1 className="text-3xl font-bold">Ship designs</h1>
    <p className="text-gray-300">Designs are private to their author and GMs. Submit a saved design for feedback and acceptance before play.</p>
    {error&&<p role="alert" className="text-red-300">{error}</p>}
    {loaded&&!error&&!creating&&<button className="bg-cyan-800 rounded p-3" onClick={()=>setCreating(true)}>New design</button>}
    {creating&&<form onSubmit={create} className="bg-gray-800 rounded p-4 space-y-3"><label className="block">Design name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="block bg-gray-950 p-2 w-full"/></label><label className="block">Starting plan<select value={template} onChange={e=>setTemplate(e.target.value)} className="block bg-gray-950 p-2"><option value="blank">Blank</option>{SHIP_TEMPLATES.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button disabled={busy||!name.trim()} className="bg-cyan-800 rounded p-2">Create private design</button><button type="button" disabled={busy} className="p-2" onClick={()=>setCreating(false)}>Cancel</button></form>}
    {!loaded?<p>Loading designs…</p>:<>{gm&&<section><h2 className="text-xl">GM review queue</h2>{rows.filter(d=>d.status==='submitted').map(d=><Link className="block border border-cyan-800 rounded p-3 mt-2" key={d.id} href={`/v2/designs/${d.id}`}>{d.name} · Revision {d.version}</Link>)}</section>}<section><h2 className="text-xl">My designs</h2>{rows.filter(d=>d.author_id===user).map(d=><Link className="block bg-gray-800 rounded p-3 mt-2" key={d.id} href={`/v2/designs/${d.id}`}>{d.name} · {d.status.replaceAll('_',' ')}</Link>)}</section>{gm&&<details><summary>All designs</summary>{rows.map(d=><Link className="block p-2" key={d.id} href={`/v2/designs/${d.id}`}>{d.name} · {d.status.replaceAll('_',' ')}</Link>)}</details>}</>}
  </div></main>
}
