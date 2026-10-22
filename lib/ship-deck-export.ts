import {partFootprint,deckHeight,type Ship,type Deck} from './ships'
import {apertureSize} from './ship-openings'

const xml=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'')
const wrap=(text:string,length:number)=>text.match(new RegExp(`.{1,${length}}(?:\\s|$)|.{1,${length}}`,'gu'))?.map(s=>s.trim())??['']
// Self-contained vector document: no scripts, external fonts/images, notes,
// account IDs, assignments or editor state. Coordinates are the actual grid.
export function exportDeckSvg(ship:Ship,deck:Deck,draft=false):string{
  const unit=32,margin=40,mapWidth=deck.width*unit,mapHeight=deck.height*unit,legendX=margin+mapWidth+40,width=Math.max(960,legendX+380),top=128
  const parts=ship.plan.parts.filter(p=>p.deck_id===deck.id),connections=ship.plan.connections.filter(c=>c.from_deck===deck.id||c.to_deck===deck.id)
  const legend:string[]=[];let row=top+20
  const text=(x:number,y:number,value:string,size=13,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" ${extra}>${xml(value)}</text>`
  function entry(label:string,detail:string){for(const line of wrap(label,40)){legend.push(text(legendX,row,line,14,'font-weight="600"'));row+=19}for(const line of wrap(detail,43)){legend.push(text(legendX+12,row,line,12));row+=17}row+=10}
  for(const [i,r] of deck.rooms.entries())entry(`R${i+1} · ${r.width*5} × ${r.height*5} ft`,r.name)
  for(const [i,p] of parts.entries())entry(`P${i+1} · ${p.quantity} × ${p.type}`,p.name)
  for(const [i,c] of connections.entries()){const destination=ship.plan.decks.find(d=>d.id===(c.from_deck===deck.id?c.to_deck:c.from_deck));entry(`C${i+1} · ${c.kind}`,`${c.name} → ${destination?.name??'Connected deck'}`)}
  const height=Math.max(top+mapHeight+100,row+50),items:string[]=[]
  items.push(`<rect x="0" y="0" width="${mapWidth}" height="${mapHeight}" fill="#fff" stroke="#94a3b8"/>`)
  for(const [i,r] of deck.rooms.entries()){
    items.push(`<rect x="${r.x*unit}" y="${r.y*unit}" width="${r.width*unit}" height="${r.height*unit}" fill="#f1f5f9" stroke="#172638" stroke-width="3"/>`)
    items.push(text(r.x*unit+7,r.y*unit+17,`R${i+1}`,12,'font-weight="700"'))
    const lines=wrap(r.name,Math.max(3,Math.floor((r.width*unit-12)/7))).slice(0,Math.max(0,Math.floor((r.height*unit-26)/16)))
    for(const [n,line] of lines.entries())items.push(text(r.x*unit+7,r.y*unit+34+n*16,line,11))
  }
  for(const m of deck.marks){
    if(m.kind==='label')items.push(text(m.x*unit+3,m.y*unit+17,m.name,12))
    else items.push(`<line x1="${m.x*unit}" y1="${m.y*unit}" x2="${(m.x+(m.vertical?0:m.length))*unit}" y2="${(m.y+(m.vertical?m.length:0))*unit}" stroke="${m.kind==='door'?'#b45309':'#172638'}" stroke-width="${m.kind==='door'?5:4}" ${m.kind==='door'?'stroke-dasharray="6 3"':''}/>`)
  }
  for(const [i,p] of parts.entries()){
    const size=partFootprint(p.type),x=p.x*unit,y=p.y*unit,w=size.width*unit,h=size.height*unit
    if(p.type==='Port wing'||p.type==='Starboard wing')items.push(`<polygon points="${p.type==='Port wing'?`${x+w},${y} ${x},${y+h*.4} ${x},${y+h*.9} ${x+w},${y+h}`:`${x},${y} ${x+w},${y+h*.4} ${x+w},${y+h*.9} ${x},${y+h}`}" fill="#dbeafe" stroke="#1e3a5f" stroke-width="2"/>`)
    else items.push(`<rect x="${x+2}" y="${y+2}" width="${w-4}" height="${h-4}" rx="3" fill="${p.type==='Booster'?'#fef3c7':'#dbeafe'}" stroke="#1e3a5f" stroke-width="1.5"/>`)
    items.push(text(x+w/2,y+h/2+4,`P${i+1}`,10,'text-anchor="middle" font-weight="700"'))
  }
  for(const [i,c] of connections.entries()){
    const p=c.from_deck===deck.id?c.from:c.to,size=apertureSize(c)
    items.push(`<rect x="${p.x*unit}" y="${p.y*unit}" width="${size.width*unit}" height="${size.height*unit}" fill="url(#opening)" stroke="#7c3aed" stroke-width="2"/>`)
    items.push(text(p.x*unit+4,p.y*unit+16,`C${i+1}`,11,'font-weight="700"'))
  }
  const header=wrap(`${ship.name} — ${deck.name}`,Math.floor((width-80)/13)).slice(0,2).map((line,i)=>text(margin,38+i*27,line,22,'font-weight="700"')).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(`${ship.name}: ${deck.name} deck plan`)}"><title>${xml(`${ship.name} — ${deck.name}`)}</title><desc>Top-down deck plan. Front is up. One grid cell is five feet. Room, component and connection keys refer to the legend.</desc><defs><clipPath id="map-clip"><rect width="${mapWidth}" height="${mapHeight}"/></clipPath><pattern id="opening" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><path d="M0 8L8 0" stroke="#c4b5fd"/></pattern></defs><rect width="100%" height="100%" fill="#fff"/><g font-family="Arial, Helvetica, sans-serif" fill="#172638">${header}${text(margin,96,`${draft?'UNSAVED DRAFT':'Saved revision '+ship.version} · ${deck.width*5} × ${deck.height*5} ft grid · ${deckHeight(deck)} ft deck height · FRONT ↑`,13)}<g transform="translate(${margin} ${top})" clip-path="url(#map-clip)">${items.join('')}</g>${text(legendX,top-12,'PLAN KEY',14,'font-weight="700"')}${legend.join('')}${text(margin,top+mapHeight+32,'Doors: dashed amber · Openings: violet hatch · Blue: components',12)}<path d="M${margin} ${top+mapHeight+60}h${5*unit}" stroke="#172638" stroke-width="4"/>${text(margin,top+mapHeight+80,'25 ft (five grid cells)',12)}</g></svg>`
}

export function deckExportFilename(shipName:string,deckName:string){return `${shipName}-${deckName}`.replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/-+/g,'-').replace(/^-+|-+$/g,'').slice(0,100)||'ship-deck'}
