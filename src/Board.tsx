import {Component,lazy,Suspense,useState,type ReactNode} from 'react';
import {Flag,Maximize2,Minimize2} from 'lucide-react';
import type {Game} from './lib/engine';
import Board2D from './Board2D';

const Board3D=lazy(()=>import('./Board3D'));
type Props={game:Game;inspect:(id:string)=>void;effect?:string;reduced?:boolean;fast?:boolean};

class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?this.props.fallback:this.props.children;}
}

export default function Board(props:Props){
 const [flat,setFlat]=useState(false),[zoom,setZoom]=useState(false);
 const board={...props,follow:zoom};
 const title=props.game.round%2?'Wild Wilds':'Mild Mile';
 const fallback=<>
  <p className="scene-notice">La vista 3D no está disponible en este dispositivo.</p>
  <Board2D {...board}/>
 </>;

 return <section className={`board-view ${zoom?'board-zoomed':''}`} aria-label={title}>
  <div className="board-view-switch">
   <h2><Flag size={19} aria-hidden="true"/>{title}</h2>
   <div className="board-view-actions" role="group" aria-label="Vista del tablero">
    <div className="board-view-modes">
     <button type="button" onClick={()=>setFlat(false)} aria-pressed={!flat}>3D</button>
     <button type="button" onClick={()=>setFlat(true)} aria-pressed={flat}>Plana</button>
    </div>
    <button type="button" className="board-zoom" onClick={()=>setZoom(v=>!v)} aria-pressed={zoom}>
     {zoom?<Minimize2 size={16} aria-hidden="true"/>:<Maximize2 size={16} aria-hidden="true"/>}
     {zoom?'Ajustar':'Ampliar'}
    </button>
   </div>
  </div>
  {flat?<Board2D {...board}/>:<SceneBoundary fallback={fallback}>
   <Suspense fallback={<div className="scene-loading" role="status">Preparando la mesa…</div>}>
    <Board3D {...board} fallback={fallback}/>
   </Suspense>
  </SceneBoundary>}
 </section>;
}
