'use client';
import {useEffect,useRef,useState} from 'react';
export default function DraggableAssistant({children}:any){
 const root=useRef<HTMLDivElement>(null),drag=useRef<any>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),suppressClick=useRef(false);
 const [position,setPosition]=useState({right:18,bottom:15}),[dragging,setDragging]=useState(false);
 function clamp(p:{right:number;bottom:number}){const rect=root.current?.getBoundingClientRect();return {right:Math.max(8,Math.min(p.right,window.innerWidth-(rect?.width||60)-8)),bottom:Math.max(8,Math.min(p.bottom,window.innerHeight-(rect?.height||60)-8))};}
 function stop(){if(timer.current)clearTimeout(timer.current);timer.current=null;const current=drag.current;drag.current=null;setDragging(false);if(current?.target.hasPointerCapture(current.pointerId))current.target.releasePointerCapture(current.pointerId);}
 useEffect(()=>{const resize=()=>setPosition(p=>clamp(p));window.addEventListener('resize',resize);const observer=new ResizeObserver(resize);if(root.current)observer.observe(root.current);return()=>{window.removeEventListener('resize',resize);observer.disconnect();if(timer.current)clearTimeout(timer.current);};},[]);
 return <div ref={root} className={'assistantwidget noprint'+(dragging?' assistant-dragging':'')} style={position}
 onPointerDownCapture={e=>{const target=(e.target as HTMLElement).closest<HTMLButtonElement>('.assistanttoggle');if(!target||e.button!==0||!e.isPrimary)return;suppressClick.current=false;drag.current={x:e.clientX,y:e.clientY,...position,target,pointerId:e.pointerId,active:false};timer.current=setTimeout(()=>{const current=drag.current;if(!current)return;current.active=true;suppressClick.current=true;current.target.setPointerCapture(current.pointerId);setDragging(true);},100);}}
 onPointerMoveCapture={e=>{const current=drag.current;if(!current||e.pointerId!==current.pointerId)return;if(!current.active){if(Math.hypot(e.clientX-current.x,e.clientY-current.y)>8)stop();return;}e.preventDefault();setPosition(clamp({right:current.right-(e.clientX-current.x),bottom:current.bottom-(e.clientY-current.y)}));}}
 onPointerUpCapture={stop} onPointerCancelCapture={stop} onLostPointerCapture={()=>{if(drag.current?.active)stop();}}
 onClickCapture={e=>{if(suppressClick.current&&(e.target as HTMLElement).closest('.assistanttoggle')){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}}
 onContextMenu={e=>{if((e.target as HTMLElement).closest('.assistanttoggle'))e.preventDefault();}}
 onKeyDown={e=>{if(!e.altKey||!(e.target as HTMLElement).closest('.assistanttoggle'))return;const moves:Record<string,number[]>={ArrowLeft:[10,0],ArrowRight:[-10,0],ArrowUp:[0,10],ArrowDown:[0,-10]};if(moves[e.key]){e.preventDefault();const [x,y]=moves[e.key];setPosition(p=>clamp({right:p.right+x,bottom:p.bottom+y}));}}}>{children}</div>;
}
