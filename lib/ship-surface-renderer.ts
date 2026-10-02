import * as THREE from 'three'
import type {ShipPlan} from './ships'
import {deckElevations,type SceneOptions} from './ship-scene'
import {roomSurfaces,surfaceModeActive} from './ship-surfaces'
import {PAINT_STRIDE} from './ship-paint'
// One mesh per surface segment, never per painted square. Textures are allocated
// only for painted surfaces, with a total 16-million-pixel / 64 MB RGBA budget.
export function createSurfaceMeshes(plan:ShipPlan,options:SceneOptions,transparent:boolean){
  const meshes:THREE.Mesh[]=[],textures:THREE.Texture[]=[],materials:THREE.Material[]=[]
  let pixels=0,omitted=0;const elevations=deckElevations(plan.decks,options.separated)
  if(surfaceModeActive(plan,options.mode))for(const deck of plan.decks){
    if(options.allDecks?options.hiddenDeckIds?.includes(deck.id):deck.id!==options.deckId)continue
    const base=options.allDecks?elevations.get(deck.id)!:0
    for(const room of deck.rooms)for(const q of roomSurfaces(plan,deck,room)){
      if(options.mode==='exterior'?!q.hull:q.hull)continue
      if((q.face==='roof'||q.face==='ceiling')&&!options.roofs)continue
      if(meshes.length>=2000){omitted++;continue}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(q.vertices.flatMap(v=>[v[0]/5,v[1]/5+base,v[2]/5]),3));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals()
      let map:THREE.CanvasTexture|undefined
      const width=Math.max(1,Math.ceil((q.width+q.uOffset)*2)),height=Math.max(1,Math.ceil(q.height*2))
      if(q.paint?.runs.length&&pixels+width*height<=16*1024*1024){
        pixels+=width*height;const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
        const ctx=canvas.getContext('2d')!;ctx.fillStyle=q.color;ctx.fillRect(0,0,width,height)
        for(const [start,length,index] of q.paint.runs){ctx.fillStyle=q.paint.palette[index];for(let at=start;at<start+length;at++){const x=at%PAINT_STRIDE,y=Math.floor(at/PAINT_STRIDE);if(x*2<width&&y*2<height)ctx.fillRect(x*2,height-(y+1)*2,2,2)}}
        map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.minFilter=THREE.NearestFilter;map.magFilter=THREE.NearestFilter;map.generateMipmaps=false;textures.push(map)
      }else if(q.paint?.runs.length)omitted++
      const u0=q.uOffset*2/width,u1=(q.uOffset+q.width)*2/width,v1=q.height*2/height
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute([u0,0,u1,0,u1,v1,u0,v1],2))
      const clipY=options.mode==='cutaway'&&!options.roofs&&q.face.startsWith('interior')?base+(deck.height_ft??8)/5*.45:undefined
      const material=new THREE.MeshStandardMaterial({color:map?'#ffffff':q.color,map:map??null,side:THREE.DoubleSide,roughness:.65,metalness:q.hull?.35:.05,transparent:q.hull&&transparent,opacity:q.hull&&transparent?.18:1,depthWrite:!(q.hull&&transparent),clippingPlanes:clipY===undefined?[]:[new THREE.Plane(new THREE.Vector3(0,-1,0),clipY)]})
      const mesh=new THREE.Mesh(geometry,material);mesh.userData={hull:q.hull,selection:{kind:'room',id:q.roomId},deckId:q.deckId,face:q.face,clipY};materials.push(material);meshes.push(mesh)
    }
  }
  return {meshes,omitted,dispose:()=>{meshes.forEach(m=>m.geometry.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose())}}
}
