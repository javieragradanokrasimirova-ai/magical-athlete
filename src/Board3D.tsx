'use client';
import {seatColors} from './lib/presentation';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Canvas,useFrame,useThree,type ThreeEvent} from '@react-three/fiber';
import {OrbitControls,RoundedBox,useTexture} from '@react-three/drei';
import {CanvasTexture,DoubleSide,MathUtils,SRGBColorSpace,Vector3,type Group} from 'three';
import type {OrbitControls as OrbitImpl} from 'three-stdlib';
import type {Game,Runner} from './lib/engine';
import {artwork,asset} from './lib/racers';
import {point} from './Board2D';
type Command={id:number,kind:string};
function CameraRig({command,reduced}:{command:Command,reduced:boolean}){
 const controls=useRef<OrbitImpl>(null);
 const {camera,size,invalidate}=useThree();
 const distance=Math.max(22,11.5/(Math.tan(MathUtils.degToRad(19))*Math.max(.5,size.width/size.height)));
 useEffect(()=>{camera.position.set(0,distance*.68,distance*.74);camera.lookAt(0,0,0);controls.current?.target.set(0,0,0);controls.current?.update();invalidate()},[camera,distance,invalidate]);
 useEffect(()=>{const c=controls.current;if(!c)return;const offset=camera.position.clone().sub(c.target);
  if(command.kind==='reset'){c.target.set(0,0,0);camera.position.set(0,distance*.68,distance*.74)}
  else if(command.kind==='left'||command.kind==='right'){offset.applyAxisAngle(new Vector3(0,1,0),command.kind==='left'?.3:-.3);camera.position.copy(c.target).add(offset)}
  else if(command.kind==='in'||command.kind==='out'){offset.multiplyScalar(command.kind==='in'?.8:1.25);offset.clampLength(10,distance*2);camera.position.copy(c.target).add(offset)}
  else if(command.kind==='top'){camera.position.set(0,distance,.01)}
  c.update();invalidate();
 },[command,camera,distance,invalidate]);
 return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping={!reduced} dampingFactor={.12} minDistance={10} maxDistance={distance*2} minPolarAngle={.02} maxPolarAngle={Math.PI/2-.12}/>;
}
function Surface({mild}:{mild:boolean}){
 const textures=useTexture(mild?[asset('board-mild-left.webp'),asset('board-mild-right.webp')]:[asset('board-wild.png')]);
 const map=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=660;const ctx=canvas.getContext('2d')!;ctx.scale(2,2);
  if(mild){const scale=960/1599;ctx.drawImage(textures[0].image as CanvasImageSource,20,20,935*scale,487*scale);ctx.drawImage(textures[1].image as CanvasImageSource,20+934*scale,20,665*scale,487*scale)}else ctx.drawImage(textures[0].image as CanvasImageSource,0,-330,1000,1000);
  const t=new CanvasTexture(canvas);t.colorSpace=SRGBColorSpace;t.anisotropy=4;return t;
 },[mild,textures[0],textures[1]]);
 useEffect(()=>()=>map.dispose(),[map]);
 return <><RoundedBox args={[20,.2,6.6]} radius={.08} smoothness={3} position={[0,-.13,0]} castShadow receiveShadow><meshStandardMaterial color="#24251f" roughness={.8}/></RoundedBox><mesh rotation={[-Math.PI/2,0,0]} position={[0,-.019,0]}><planeGeometry args={[20,6.6]}/><meshBasicMaterial map={map} transparent toneMapped={false}/></mesh></>;
}
function Piece({r,mild,dx,dz,active,effect,reduced,fast,inspect}:{r:Runner,mild:boolean,dx:number,dz:number,active:boolean,effect:string,reduced:boolean,fast:boolean,inspect:(id:string)=>void}){
 const texture=useTexture(artwork(r.id));const group=useRef<Group>(null),stand=useRef<Group>(null);const {invalidate}=useThree();
 const motion=useRef({from:r.pos,to:r.pos,elapsed:1,duration:0,dx,dz,fromDx:dx,fromDz:dz,trip:r.trip?-Math.PI/2:0,fromTrip:r.trip?-Math.PI/2:0});
 useEffect(()=>{const m=motion.current;const progress=m.duration?Math.min(1,m.elapsed/m.duration):1;const current=m.from+(m.to-m.from)*(1-(1-progress)**3);motion.current={from:current,to:r.pos,elapsed:0,duration:reduced?0:(fast?.45:1)*Math.min(.95,.42+Math.abs(r.pos-current)*.04),dx,dz,fromDx:m.dx,fromDz:m.dz,trip:r.trip?-Math.PI/2:0,fromTrip:stand.current?.rotation.x??0};invalidate()},[r.pos,r.trip,dx,dz,reduced,fast,invalidate]);
 useFrame((_,delta)=>{const m=motion.current;m.elapsed+=Math.min(delta,.1);const t=m.duration?Math.min(1,m.elapsed/m.duration):1,e=1-(1-t)**3;const p=effect==='warp'?(t<.5?m.from:m.to):MathUtils.lerp(m.from,m.to,e);const a=point(Math.floor(p),mild),b=point(Math.min(30,Math.ceil(p)),mild),f=p-Math.floor(p);if(group.current){group.current.position.set((MathUtils.lerp(a[0],b[0],f)-500)/50+MathUtils.lerp(m.fromDx,m.dx,e),.08+(reduced?0:Math.sin(t*Math.PI)*.15),(MathUtils.lerp(a[1],b[1],f)-495)/50+MathUtils.lerp(m.fromDz,m.dz,e));group.current.scale.setScalar(effect==='warp'&&!reduced?Math.max(.06,Math.abs(t-.5)*2):1)}if(stand.current)stand.current.rotation.x=MathUtils.lerp(m.fromTrip,m.trip,e);if(t<1)invalidate()});
 const click=(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();if(e.delta<5&&!r.out)inspect(r.id)};const color=seatColors[r.owner];
 return <group ref={group} visible={!r.out} onClick={click}><mesh castShadow><cylinderGeometry args={[.38,.43,.14,32]}/><meshStandardMaterial color={color} roughness={.5}/></mesh>{active&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.083,0]}><ringGeometry args={[.44,.5,40]}/><meshBasicMaterial color="#ffe16a" side={DoubleSide}/></mesh>}<group ref={stand} position={[0,.1,0]}><RoundedBox args={[.72,1.04,.08]} radius={.035} position={[0,.52,0]} castShadow><meshStandardMaterial color={color}/></RoundedBox><mesh position={[0,.52,.045]}><planeGeometry args={[.64,.94]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh><mesh position={[0,.52,-.045]} rotation={[0,Math.PI,0]}><planeGeometry args={[.64,.94]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh></group></group>;
}
function ContextGuard({failed}:{failed:()=>void}){const gl=useThree(s=>s.gl);useEffect(()=>{const canvas=gl.domElement;const lost=(e:Event)=>{e.preventDefault();failed()};canvas.addEventListener('webglcontextlost',lost);return()=>canvas.removeEventListener('webglcontextlost',lost)},[gl,failed]);return null}
export default function Board3D({game:g,inspect,effect='',reduced=false,fast=false,follow=false,fallback}:{game:Game,inspect:(id:string)=>void,effect?:string,reduced?:boolean,fast?:boolean,follow?:boolean,fallback:ReactNode}){
 const [command,setCommand]=useState<Command>({id:0,kind:'reset'}),[failed,setFailed]=useState(false);if(failed)return <>{fallback}</>;
 return <div className={`tabletop ${follow?'tabletop-expanded':''}`}><div className="tabletop-canvas" role="group" aria-label="Tablero 3D. Arrastra para girar y usa los controles para acercar o restablecer la vista."><Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[0,20,24],fov:38,near:.1,far:160}} shadows="percentage">
 <color attach="background" args={['#e9e4d5']}/><ambientLight intensity={1.6}/><directionalLight position={[-8,16,8]} intensity={2.4} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={.04}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-.26,0]} receiveShadow><planeGeometry args={[200,200]}/><meshStandardMaterial color="#e9e4d5" roughness={1}/></mesh><Surface mild={g.round%2===0}/>
 {g.runners.map(r=>{const same=g.runners.filter(a=>a.pos===r.pos&&!a.out),j=Math.max(0,same.indexOf(r));const columns=r.pos===0?3:2,row=Math.floor(j/columns),rowCount=Math.min(columns,same.length-row*columns);const dx=(j%columns-(rowCount-1)/2)*.72,dz=row*(r.pos<=12?.65:-.65);return <Piece key={`${g.round}-${r.id}`} r={r} mild={g.round%2===0} dx={dx} dz={dz} active={g.active===r.id} effect={effect} reduced={reduced} fast={fast} inspect={inspect}/>})}<CameraRig command={command} reduced={reduced}/><ContextGuard failed={()=>setFailed(true)}/></Canvas></div>
 <div className="tabletop-tools" role="group" aria-label="Cámara del tablero">{[['left','Girar izquierda','↶'],['right','Girar derecha','↷'],['in','Acercar','＋'],['out','Alejar','−'],['top','Vista desde arriba','Desde arriba'],['reset','Restablecer vista','Restablecer']].map(([kind,label,text])=><button key={kind} aria-label={label} onClick={()=>setCommand(c=>({id:c.id+1,kind}))}>{text}</button>)}</div><p className="tabletop-help">Arrastra para girar · Rueda o pellizca para acercar · Pulsa una ficha para ver su poder</p></div>;
}
