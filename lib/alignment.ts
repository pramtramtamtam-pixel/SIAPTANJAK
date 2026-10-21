import {assert,one} from './server';
import {validGoalSelection} from './workflow';
export async function validateAlignment(value:any,previous:any={}){
 assert(validGoalSelection(value.sdgs),'Pilih minimal satu SDGs yang valid (1–17).');
 assert(Array.isArray(value.program)&&value.program.length>0&&value.program.length<=12&&new Set(value.program).size===value.program.length,'Pilih minimal satu program strategis yang valid.');
 for(const id of value.program){assert(typeof id==='string','Program strategis tidak valid.');const row=await one("SELECT id,active FROM master WHERE id=? AND type='program'",id);assert(row&&(row.active||previous.program?.includes(id)),'Program strategis tidak valid atau tidak aktif.');}
 return {program:[...value.program],sdgs:value.sdgs.map(String)};
}
