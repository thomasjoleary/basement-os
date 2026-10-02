import {deckHoles,hasLadder,openingContains,type OpeningRect} from './ship-openings'
import type {Deck,ShipPlan,Point} from './ships'
export const WALK_RADIUS=.16
export type Wall={x:number;y:number;vertical:boolean}
export function walkWalls(deck:Deck):Wall[]{
 const edges=new Map<string,Wall>(),put=(x:number,y:number,vertical:boolean)=>edges.set(`${x}:${y}:${vertical}`,{x,y,vertical})
 for(const r of deck.rooms){for(let x=r.x;x<r.x+r.width;x++){put(x,r.y,false);put(x,r.y+r.height,false)}for(let y=r.y;y<r.y+r.height;y++){put(r.x,y,true);put(r.x+r.width,y,true)}}
 for(const m of deck.marks.filter(m=>m.kind==='wall'))for(let i=0;i<m.length;i++)put(m.x+(m.vertical?0:i),m.y+(m.vertical?i:0),m.vertical)
 for(const m of deck.marks.filter(m=>m.kind==='door'))for(let i=0;i<m.length;i++)edges.delete(`${m.x+(m.vertical?0:i)}:${m.y+(m.vertical?i:0)}:${m.vertical}`)
 return [...edges.values()]
}
export function walkable(deck:Deck,p:Point,walls=walkWalls(deck),holes:OpeningRect[]=[]){
 if(holes.some(h=>openingContains(h,p,WALK_RADIUS+.05)))return false
 // Keep the complete body on room floor, even at open exterior doorways.
 for(const [dx,dy] of [[0,0],[WALK_RADIUS,0],[-WALK_RADIUS,0],[0,WALK_RADIUS],[0,-WALK_RADIUS]])if(!deck.rooms.some(r=>p.x+dx>=r.x&&p.x+dx<=r.x+r.width&&p.y+dy>=r.y&&p.y+dy<=r.y+r.height))return false
 return !walls.some(w=>{const x=w.vertical?w.x:Math.max(w.x,Math.min(w.x+1,p.x)),y=w.vertical?Math.max(w.y,Math.min(w.y+1,p.y)):w.y;return Math.hypot(p.x-x,p.y-y)<WALK_RADIUS+.05})
}
export function walkSpawn(deck:Deck,near?:Point,holes:OpeningRect[]=[]):Point|null{
 const walls=walkWalls(deck)
 if(near){for(const radius of [0,.3,.6,1])for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const p={x:near.x+.5+radius*dx,y:near.y+.5+radius*dy};if(walkable(deck,p,walls,holes))return p}return null}
 for(const r of deck.rooms){const p={x:r.x+r.width/2,y:r.y+r.height/2};if(walkable(deck,p,walls,holes))return p;for(let y=r.y+.5;y<r.y+r.height;y++)for(let x=r.x+.5;x<r.x+r.width;x++)if(walkable(deck,{x,y},walls,holes))return {x,y}}
 return null
}
export function walkStep(deck:Deck,p:Point,dx:number,dy:number,walls=walkWalls(deck),holes:OpeningRect[]=[]):Point{
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.08));let next={...p};for(let i=0;i<steps;i++){const x={x:next.x+dx/steps,y:next.y};if(walkable(deck,x,walls,holes))next=x;const y={x:next.x,y:next.y+dy/steps};if(walkable(deck,y,walls,holes))next=y}return next
}
export function ladderDestination(plan:ShipPlan,deckId:string,id:string){const c=plan.connections.find(c=>c.id===id);if(!c||!hasLadder(plan,c))return null;const from=c.from_deck===deckId,to=c.to_deck===deckId;if(!from&&!to)return null;const deck=plan.decks.find(d=>d.id===(from?c.to_deck:c.from_deck));if(!deck||deck.id===deckId)return null;const position=walkSpawn(deck,from?c.to:c.from,deckHoles(plan,deck.id,'floor'));return position?{deck,position}:null}
