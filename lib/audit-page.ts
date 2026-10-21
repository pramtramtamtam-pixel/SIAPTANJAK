import {all,one} from './server';
import {paginationRequest,paginationResult} from './pagination';
export async function readAuditPage(params:URLSearchParams){
 const {page,limit}=paginationRequest(params),query=(params.get('query')||'').trim().slice(0,100),like='%'+query.replace(/[\\%_]/g,'\\$&')+'%';
 const where=query?" WHERE (a.action LIKE ? ESCAPE '\\' OR a.entity LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')":'';
 const args=query?[like,like,like]:[];
 const total=Number((await one('SELECT COUNT(*) n FROM audit_log a LEFT JOIN users u ON u.id=a.user_id'+where,...args)).n);
 const pagination=paginationResult(page,limit,total);
 const rows=await all('SELECT a.*,u.name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id'+where+' ORDER BY a.created DESC,a.id DESC LIMIT ? OFFSET ?',...args,limit,pagination.offset);
 return {rows,pagination};
}
