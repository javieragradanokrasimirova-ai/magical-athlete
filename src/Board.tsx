'use client';
import {Component,lazy,Suspense,useEffect,useState,type ReactNode} from 'react';
import type {Game} from './lib/engine';
import Board2D from './Board2D';
const Board3D=lazy(()=>import('./Board3D'));
type Props={game:Game,inspect:(id:string)=>void,effect?:string,reduced?:boolean,fast?:boolean,follow?:boolean};
class SceneBoundary extends Component<{children:ReactNode,fallback:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?this.props.fallback:this.props.children}
}
export default function Board(props:Props){
 const [mounted,setMounted]=useState(false),[flat,setFlat]=useState(false);
 useEffect(()=>setMounted(true),[]);
 const fallback=<><p className="scene-notice">La vista 3D no está disponible en este dispositivo. Puedes seguir jugando en la vista plana.</p><Board2D {...props}/></>;
 return <div className="board-view"><div className="board-view-switch"><span>{flat?'Vista del tablero':'Mesa de juego · 3D'}</span><button onClick={()=>setFlat(v=>!v)} aria-pressed={flat}>{flat?'Volver al 3D':'Vista plana'}</button></div>{flat?<Board2D {...props}/>:mounted?<SceneBoundary fallback={fallback}><Suspense fallback={<div className="scene-loading" role="status">Preparando la mesa de juego…</div>}><Board3D {...props} fallback={fallback}/></Suspense></SceneBoundary>:<div className="scene-loading">Preparando la mesa de juego…</div>}</div>
}
