// Surface-local feet, independent of the five-foot room layout grid. A fixed
// address stride keeps paint stable when a face changes width or is clipped.
export const PAINT_STRIDE = 1024
export const MAX_PAINT_TILES = 50000
export const MAX_PAINT_RUNS = 10000
export type PaintRun = [start: number, length: number, paletteIndex: number]
export type SurfacePaint = { palette: string[]; runs: PaintRun[] }
export type FootTile = { x: number; y: number }
export type SurfaceFace = 'floor'|'ceiling'|'interior-front'|'interior-rear'|'interior-port'|'interior-starboard'|'roof'|'exterior-front'|'exterior-rear'|'exterior-port'|'exterior-starboard'
export type PaintedSurface = { id: string; deck_id: string; room_id: string; face: SurfaceFace; color?: string; paint: SurfacePaint }
export const EMPTY_PAINT: SurfacePaint = { palette: [], runs: [] }
const colorPattern = /^#[0-9a-fA-F]{6}$/
export function paintError(paint: SurfacePaint): string|null {
  if(!Array.isArray(paint?.palette)||paint.palette.length>64||paint.palette.some(c=>!colorPattern.test(c))||!Array.isArray(paint.runs)||paint.runs.length>MAX_PAINT_RUNS)return 'Invalid paint palette or run count.'
  let previous=-1,count=0
  for(const r of paint.runs){
    if(!Array.isArray(r)||r.length!==3||!r.every(Number.isInteger)||r[0]<=previous||r[0]<0||r[1]<1||r[0]+r[1]>PAINT_STRIDE**2||r[2]<0||r[2]>=paint.palette.length)return 'Paint runs must be ordered, disjoint and inside the address grid.'
    previous=r[0]+r[1]-1;count+=r[1]
  }
  return count>MAX_PAINT_TILES?'Paint exceeds 50,000 squares.':null
}
export function decodePaint(paint: SurfacePaint): Map<number,string> {
  const error=paintError(paint);if(error)throw new Error(error)
  const result=new Map<number,string>()
  for(const [start,length,index] of paint.runs)for(let i=0;i<length;i++)result.set(start+i,paint.palette[index])
  return result
}
export function encodePaint(tiles:Map<number,string>):SurfacePaint {
  if(tiles.size>MAX_PAINT_TILES)throw new Error('Paint exceeds 50,000 squares.')
  const palette=[...new Set(tiles.values())].sort(),runs:PaintRun[]=[]
  for(const [at,color] of [...tiles.entries()].sort((a,b)=>a[0]-b[0])){
    const index=palette.indexOf(color),last=runs.at(-1)
    if(last&&last[0]+last[1]===at&&last[2]===index)last[1]++
    else runs.push([at,1,index])
  }
  const result={palette,runs},error=paintError(result);if(error)throw new Error(error)
  return result
}
export function paintTiles(paint:SurfacePaint,tiles:Iterable<FootTile>,color:string|null):SurfacePaint {
  if(color!==null&&!colorPattern.test(color))throw new Error('Use a six-digit color.')
  const result=decodePaint(paint)
  for(const {x,y} of tiles){
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=PAINT_STRIDE||y>=PAINT_STRIDE)throw new Error('Square is outside the surface address grid.')
    if(color===null)result.delete(y*PAINT_STRIDE+x);else result.set(y*PAINT_STRIDE+x,color.toLowerCase())
    if(result.size>MAX_PAINT_TILES)throw new Error('Paint exceeds 50,000 squares.')
  }
  return encodePaint(result)
}
export function* rectangleTiles(from:FootTile,to:FootTile):Generator<FootTile> {
  for(let y=Math.min(from.y,to.y);y<=Math.max(from.y,to.y);y++)for(let x=Math.min(from.x,to.x);x<=Math.max(from.x,to.x);x++)yield{x,y}
}
// Bresenham interpolation prevents holes when pointer events skip squares.
export function* strokeTiles(from:FootTile,to:FootTile):Generator<FootTile> {
  let x=from.x,y=from.y;const dx=Math.abs(to.x-x),dy=-Math.abs(to.y-y),sx=x<to.x?1:-1,sy=y<to.y?1:-1;let error=dx+dy
  for(;;){yield{x,y};if(x===to.x&&y===to.y)break;const twice=error*2;if(twice>=dy){error+=dy;x+=sx}if(twice<=dx){error+=dx;y+=sy}}
}
export type PaintHistory = { present:SurfacePaint; past:SurfacePaint[]; future:SurfacePaint[] }
export function recordPaint(history:PaintHistory,next:SurfacePaint):PaintHistory {
  if(JSON.stringify(history.present)===JSON.stringify(next))return history
  const past=[...history.past,history.present].slice(-50)
  // Bound retained snapshots; drafts remain untouched when history is evicted.
  while(past.length&&JSON.stringify(past).length>8*1024*1024)past.shift()
  return {present:next,past,future:[]}
}
export function undoPaint(h:PaintHistory):PaintHistory {return h.past.length?{present:h.past.at(-1)!,past:h.past.slice(0,-1),future:[h.present,...h.future]}:h}
export function redoPaint(h:PaintHistory):PaintHistory {return h.future.length?{present:h.future[0],past:[...h.past,h.present],future:h.future.slice(1)}:h}
