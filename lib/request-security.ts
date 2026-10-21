import {AsyncLocalStorage} from 'node:async_hooks';
export const securityContext=new AsyncLocalStorage<{ip:string|null}>();
export function requestIp(req:Request){const value=req.headers.get('cf-connecting-ip');return value&&/^[0-9a-f:.]{3,45}$/i.test(value)?value:null;}
export const auditIp=()=>securityContext.getStore()?.ip||null;
export const IDLE_TIMEOUT_MS=30*60*1000;
export const ABSOLUTE_TIMEOUT_MS=8*60*60*1000;
export function sessionCookie(req:Request,token:string,clear=false){return `siap_session=${token}; Path=/; HttpOnly; SameSite=Strict${new URL(req.url).protocol==='https:'?'; Secure':''}${clear?'; Max-Age=0':''}`;}
