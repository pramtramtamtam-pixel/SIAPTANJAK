import {Worker} from 'node:worker_threads';
import {sqliteWorkerSource} from './sqlite-worker-source';
export function createSqliteWorker(file:string){
 let worker:Worker|null=null,nextId=0;const pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
 function start(){if(worker)return worker;const current=new Worker(sqliteWorkerSource,{eval:true,workerData:{file}});worker=current;current.unref();
  const fail=(error:Error)=>{if(worker===current)worker=null;for(const request of pending.values())request.reject(error);pending.clear();};
  current.on('message',message=>{const request=pending.get(message.id);if(!request)return;pending.delete(message.id);if(message.error)request.reject(Object.assign(Error(message.error.message),{code:message.error.code}));else request.resolve(message.result);if(!pending.size)current.unref();});
  current.on('error',fail);current.on('exit',code=>{if(worker===current){worker=null;if(pending.size)fail(Error('Database worker stopped ('+code+')'));}});return current;
 }
 return {request(action:string,value:any={}){return new Promise<any>((resolve,reject)=>{const current=start(),id=++nextId;pending.set(id,{resolve,reject});current.ref();try{current.postMessage({id,action,...value});}catch(error){pending.delete(id);reject(error);}});},async close(){const current=worker;worker=null;for(const p of pending.values())p.reject(Error('Database worker closed'));pending.clear();if(current)await current.terminate();}};
}
