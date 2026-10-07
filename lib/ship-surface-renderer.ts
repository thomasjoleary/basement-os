import {openingLayout} from './ship-openings'
import * as THREE from 'three'
import type {ShipPlan} from './ships'
import {deckElevations,type SceneOptions} from './ship-scene'
import {roomSurfaces,surfaceModeActive} from './ship-surfaces'
import {PAINT_STRIDE} from './ship-paint'
// Thin metal backing stays inside the existing skin, below the .02 ft floor finish.
export const HULL_SKIN_THICKNESS_FT=.015
// One mesh per surface segment, never per painted square. Textures are allocated
// only for painted surfaces, with a total 16-million-pixel / 64 MB RGBA budget.
export function createSurfaceMeshes(plan:ShipPlan,options:SceneOptions,transparent:boolean){
  const meshes:THREE.Mesh[]=[],backings:THREE.Mesh[]=[],textures:THREE.Texture[]=[],materials:THREE.Material[]=[]
  const offsets=openingLayout(plan).offsets
  let pixels=0,omitted=0;const elevations=deckElevations(plan.decks,options.separated,options.mode==='exterior')
  if(options.walkthrough||surfaceModeActive(plan,options.mode,options.forceSurfaces))for(const deck of plan.decks){
    if(options.allDecks?options.hiddenDeckIds?.includes(deck.id):deck.id!==options.deckId)continue
    const base=options.allDecks?elevations.get(deck.id)!:0,offset=options.allDecks?offsets.get(deck.id)!:{x:0,y:0}
    for(const room of deck.rooms)for(const q of roomSurfaces(plan,deck,room)){
      if(options.mode==='exterior'?!q.hull:q.hull)continue
      if((q.face==='roof'||q.face==='ceiling')&&!options.roofs)continue
      if(meshes.length>=2000){omitted++;continue}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(q.vertices.flatMap(v=>[v[0]/5+offset.x,v[1]/5+base,v[2]/5+offset.y]),3));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals()
      if(q.hull){const capAxis=q.face.endsWith('port')||q.face.endsWith('starboard')?new THREE.Vector3(0,0,1):new THREE.Vector3(1,0,0);const outward=q.capSide==='top'?new THREE.Vector3(0,1,0):q.capSide==='bottom'?new THREE.Vector3(0,-1,0):q.capSide==='start'?capAxis.negate():q.capSide==='end'?capAxis:q.face==='roof'?new THREE.Vector3(0,1,0):q.face==='underside'?new THREE.Vector3(0,-1,0):new THREE.Vector3(q.face==='exterior-port'?-1:q.face==='exterior-starboard'?1:0,0,q.face==='exterior-front'?-1:q.face==='exterior-rear'?1:0);const normal=new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('normal'),0);if(normal.dot(outward)<0){geometry.setIndex([0,2,1,0,3,2]);geometry.computeVertexNormals()}}
      if(q.hull){
        // Separate unpaintable inner backing; the original exterior quad/UVs remain exact.
        const positions=geometry.getAttribute('position'),normal=new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('normal'),0),vertices:number[]=[]
        for(let layer=0;layer<2;layer++)for(let i=0;i<4;i++)vertices.push(...new THREE.Vector3().fromBufferAttribute(positions,i).addScaledVector(normal,-layer*HULL_SKIN_THICKNESS_FT/5).toArray())
        const indices:number[]=[];const front=Array.from(geometry.index!.array)
        for(let i=0;i<front.length;i+=3)indices.push(front[i]+4,front[i+2]+4,front[i+1]+4)
        const order=front[1]===1?[0,1,2,3]:[0,3,2,1]
        for(let i=0;i<4;i++){const a=order[i],b=order[(i+1)%4];indices.push(a,a+4,b+4,a,b+4,b)}
        const solid=new THREE.BufferGeometry();solid.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));solid.setIndex(indices);solid.computeVertexNormals()
        const backingMaterial=new THREE.MeshStandardMaterial({color:q.color,roughness:.65,metalness:.35,transparent,opacity:transparent?.18:1,depthWrite:!transparent})
        const backing=new THREE.Mesh(solid,backingMaterial);backing.userData={hull:true,selection:{kind:'room',id:q.roomId},deckId:q.deckId,structural:true};materials.push(backingMaterial);backings.push(backing)
      }
      let map:THREE.CanvasTexture|undefined
      const width=Math.max(1,Math.ceil((q.width+q.uOffset)*2)),height=Math.max(1,Math.ceil((q.height+(q.vOffset??0))*2))
      const visiblePaint=q.paint?.runs.some(([start,length])=>{for(let y=Math.max(Math.floor(start/PAINT_STRIDE),Math.floor(q.vOffset??0));y<=Math.min(Math.floor((start+length-1)/PAINT_STRIDE),Math.ceil((q.vOffset??0)+q.height)-1);y++){const left=Math.max(start-y*PAINT_STRIDE,0),right=Math.min(start+length-y*PAINT_STRIDE,PAINT_STRIDE);if(right>q.uOffset&&left<q.uOffset+q.width)return true}return false})
      if(visiblePaint&&q.paint&&pixels+width*height<=16*1024*1024){
        pixels+=width*height;const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
        const ctx=canvas.getContext('2d')!;ctx.fillStyle=q.color;ctx.fillRect(0,0,width,height)
        for(const [start,length,index] of q.paint.runs){ctx.fillStyle=q.paint.palette[index];for(let at=start;at<start+length;at++){const x=at%PAINT_STRIDE,y=Math.floor(at/PAINT_STRIDE);if(x*2<width&&y*2<height)ctx.fillRect(x*2,height-(y+1)*2,2,2)}}
        map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.minFilter=THREE.NearestFilter;map.magFilter=THREE.NearestFilter;map.generateMipmaps=false;textures.push(map)
      }else if(visiblePaint)omitted++
      const u0=q.uOffset*2/width,u1=(q.uOffset+q.width)*2/width,v0=(q.vOffset??0)*2/height,v1=(q.height+(q.vOffset??0))*2/height
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute([u0,v0,u1,v0,u1,v1,u0,v1],2))
      const clipY=options.mode==='cutaway'&&!options.roofs&&q.face.startsWith('interior')?base+(deck.height_ft??8)/5*.45:undefined
      const material=new THREE.MeshStandardMaterial({color:map?'#ffffff':q.color,map:map??null,side:q.hull?THREE.FrontSide:THREE.DoubleSide,roughness:.65,metalness:q.hull?.35:.05,transparent:q.hull&&transparent,opacity:q.hull&&transparent?.18:1,depthWrite:!(q.hull&&transparent),clippingPlanes:clipY===undefined?[]:[new THREE.Plane(new THREE.Vector3(0,-1,0),clipY)]})
      const mesh=new THREE.Mesh(geometry,material);mesh.userData={hull:q.hull,selection:{kind:'room',id:q.roomId},deckId:q.deckId,face:q.face,clipY,surface:q,paintWidth:width/2,paintHeight:height/2};materials.push(material);meshes.push(mesh)
    }
  }
  return {meshes,backings,omitted,dispose:()=>{backings.forEach(m=>m.geometry.dispose());meshes.forEach(m=>m.geometry.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose())}}
}
