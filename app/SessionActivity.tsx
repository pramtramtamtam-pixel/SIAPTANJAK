'use client';
import {useEffect} from 'react';
import {api} from './Portal';
export default function SessionActivity({session,onExpired}:any){
 useEffect(()=>{
  if(!session)return;
  let deadline=Number(session.idle_deadline||Date.now()+30*60000),absolute=Number(session.session_expires||Date.now()+8*3600000),lastSent=0,checking=false,alive=true;
  const ended=()=>{if(alive)onExpired();};
  const check=async()=>{if(checking)return;checking=true;try{const me=await api('me');if(!alive)return;if(!me.user)ended();else{deadline=Number(me.user.idle_deadline);absolute=Number(me.user.session_expires);}}catch{ended();}finally{checking=false;}};
  const activity=()=>{const now=Date.now();if(now>=Math.min(deadline,absolute)){check();return;}if(now-lastSent<60000)return;lastSent=now;api('auth/activity',{}).then(r=>{if(alive){deadline=Number(r.idleDeadline);absolute=Number(r.expires);}}).catch(()=>{});};
  const expired=()=>ended(),restore=(event:PageTransitionEvent)=>{if(event.persisted)check();};
  const interval=window.setInterval(()=>{if(Date.now()>=Math.min(deadline,absolute))check();},5000);
  const events=['pointerdown','pointermove','keydown','scroll','touchstart'];events.forEach(e=>window.addEventListener(e,activity,{passive:true,capture:true}));window.addEventListener('siap-session-expired',expired);window.addEventListener('pageshow',restore);
  return()=>{alive=false;clearInterval(interval);events.forEach(e=>window.removeEventListener(e,activity,true));window.removeEventListener('siap-session-expired',expired);window.removeEventListener('pageshow',restore);};
 },[session?.id]);
 return null;
}
