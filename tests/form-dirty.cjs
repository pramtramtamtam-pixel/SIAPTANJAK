// Test dirty tracking without a browser or application data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {test}=require('node:test'),assert=require('node:assert/strict');
function harness(){
 const handlers={},globalHandlers={},changes=[],controls=[];let observe=()=>{};
 const form={querySelectorAll:()=>controls};
 const root={querySelectorAll:()=>[form],contains:f=>f===form,addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener:name=>delete handlers[name]};
 const window={addEventListener:(name,fn)=>globalHandlers[name]=fn,removeEventListener:name=>delete globalHandlers[name]};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../app/form-dirty.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,window,MutationObserver:class{constructor(callback){observe=callback;}observe(){}disconnect(){}},JSON,Array,WeakMap,Set});
 const input=(name,value,type='text',ignore=false)=>{const field={name,value,type,checked:false,id:'',closest:()=>ignore?{}:null,getAttribute:key=>key==='name'?name:null};controls.push(field);return field;};
 const trigger=(name)=>handlers[name]?.({target:{closest:()=>form}});
 const start=()=>exports.watchFormChanges(root,(_form,dirty)=>changes.push(dirty));
 return {input,start,trigger,mutate:()=>observe(),saved:()=>globalHandlers['siap-form-saved'](),changes};
}
test('Opening and leaving an unchanged form stays clean',()=>{const h=harness();h.input('name','Initial');h.start();h.trigger('focusin');h.mutate();assert.equal(h.changes.at(-1),false);});
test('Map or checklist programmatic changes mark the form dirty',()=>{const h=harness(),point=h.input('lat','-3');h.start();h.trigger('pointerdown');point.value='-3.1';h.mutate();assert.equal(h.changes.at(-1),true);});
test('Restoring original field value clears dirty state',()=>{const h=harness(),field=h.input('title','Original');h.start();h.trigger('focusin');field.value='Changed';h.trigger('input');assert.equal(h.changes.at(-1),true);field.value='Original';h.trigger('input');assert.equal(h.changes.at(-1),false);});
test('Stable hidden checklist selection is tracked',()=>{const h=harness(),field=h.input('regions','[]','hidden');h.start();h.trigger('pointerdown');field.value='["Ogan Ilir"]';h.mutate();assert.equal(h.changes.at(-1),true);});
test('Opening transient checklist controls alone does not mark changes',()=>{const h=harness();h.input('regions','[]','hidden');h.start();h.trigger('pointerdown');h.input('temporary','true','checkbox',true);h.mutate();assert.equal(h.changes.at(-1),false);});
test('Saving establishes a new baseline',()=>{const h=harness(),field=h.input('title','Original');h.start();h.trigger('focusin');field.value='Saved';h.trigger('input');h.saved();h.mutate();assert.equal(h.changes.at(-1),false);});
