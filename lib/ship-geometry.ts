import * as THREE from 'three'
    export function sceneGeometry(geometries:Map<string,THREE.BufferGeometry>,shape = 'box') {
      if(geometries.has(shape)) return geometries.get(shape)!
      let result: THREE.BufferGeometry
      if(shape === 'chevron') {
        const outline=new THREE.Shape();outline.moveTo(-.5,-.4);outline.lineTo(0,.2);outline.lineTo(.5,-.4);outline.lineTo(.5,-.1);outline.lineTo(0,.5);outline.lineTo(-.5,-.1);outline.closePath()
        result=new THREE.ExtrudeGeometry(outline,{depth:1,bevelEnabled:false});result.rotateX(Math.PI/2);result.translate(0,.5,0)
      } else if(shape === 'nose' || shape.startsWith('slope-')) {
        const points = shape === 'nose'
          ? [[-.28,-.5,-.5],[.28,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[-.28,-.08,-.5],[.28,-.08,-.5],[.5,.5,.5],[-.5,.5,.5]]
          : [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[shape==='slope-port'?.1:-.5,.5,-.5],[shape==='slope-port'?.5:-.1,.5,-.5],[shape==='slope-port'?.5:-.1,.5,.5],[shape==='slope-port'?.1:-.5,.5,.5]]
        result = new THREE.BufferGeometry()
        result.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3))
        result.setIndex([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7,0,3,7,0,7,4,1,5,6,1,6,2])
        result=result.toNonIndexed();result.computeVertexNormals()
      } else if(shape === 'upright') { result = new THREE.CylinderGeometry(.5,.5,1,16) }
      else if(shape === 'engine') { result = new THREE.CylinderGeometry(.5,.43,1,16); result.rotateX(Math.PI/2) }
      else if(shape === 'port' || shape === 'starboard') {
        const outline=new THREE.Shape(), sign=shape==='port'?1:-1
        outline.moveTo(sign*.5,-.5); outline.lineTo(-sign*.5,.1); outline.lineTo(-sign*.42,.5); outline.lineTo(sign*.5,.38); outline.closePath()
        result=new THREE.ExtrudeGeometry(outline,{depth:1,bevelEnabled:false}); result.rotateX(Math.PI/2); result.translate(0,.5,0)
      } else result=new THREE.BoxGeometry(1,1,1)
      geometries.set(shape,result); return result
    }
