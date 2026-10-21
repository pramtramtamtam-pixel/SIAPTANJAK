const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
for(const name of ['AdminDashboard','ProvinceDashboard','DistrictDashboard','PdDashboard','CompanyDashboard','ReportList'])test(name+' keeps displayed data during a same-year background refresh',async()=>{
 const source=ts.createSourceFile(name+'.tsx',fs.readFileSync(path.join(__dirname,'../app/'+name+'.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let callback;function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(source)==='useEffect'&&node.arguments[0]?.getText(source).includes('loadedScope.current'))callback=node.arguments[0].getText(source);ts.forEachChild(node,visit);}visit(source);assert.ok(callback);
 const changes=[],pending=[];
 const scope={exports:{},year:2027,session:{id:'company'},loadedScope:{current:''},api:()=>new Promise(resolve=>pending.push(resolve)),setData:v=>changes.push(['data',v]),setLoaded:v=>changes.push(['data',v]),setRecords:v=>changes.push(['records',v]),setDocuments:v=>changes.push(['documents',v]),setBusy:v=>changes.push(['busy',v]),setError:()=>{}};
 vm.runInNewContext(ts.transpileModule('export const refresh='+callback,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,scope);
 const finish=async value=>{pending.shift()(value);for(let i=0;i<6;i++)await Promise.resolve();};
 const initialCleanup=scope.exports.refresh();await finish({records:[{id:'one'}],documents:[]});initialCleanup();changes.length=0;
 const cleanup=scope.exports.refresh();assert.equal(changes.length,0,'Polling must not remove content or show an empty loading panel');await finish({records:[{id:'two'}],documents:[]});assert.ok(changes.some(([,v])=>v!==null));cleanup();changes.length=0;
 scope.year=2028;const yearCleanup=scope.exports.refresh();assert.ok(changes.some(([key,v])=>key==='busy'&&v===true||key==='data'&&v===null),'Changing scope should show the initial loading state');yearCleanup();changes.length=0;await finish({records:[{id:'stale'}]});assert.equal(changes.length,0,'An abandoned request must not replace the new view');
});
test('MonitoringTimeline retains its displayed timeline during a same-scope refresh',async()=>{
 const source=ts.createSourceFile('MonitoringTimeline.tsx',fs.readFileSync(path.join(__dirname,'../app/MonitoringTimeline.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let callback;function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(source)==='useEffect'&&n.arguments[0]?.getText(source).includes('loadedScope.current'))callback=n.arguments[0].getText(source);ts.forEachChild(n,visit);}visit(source);assert.ok(callback);
 const changes=[],pending=[],scope={exports:{},session:{id:'company'},activityYear:'2028',loadedScope:{current:''},fetch:()=>new Promise(resolve=>pending.push(resolve)),setLoaded:v=>changes.push(['loaded',v]),setBusy:v=>changes.push(['busy',v]),setError:()=>{}};
 vm.runInNewContext(ts.transpileModule('export const refresh='+callback,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,scope);
 const finish=async v=>{pending.shift()({ok:true,json:async()=>v});for(let i=0;i<12;i++)await Promise.resolve();};
 const initial=scope.exports.refresh();await finish({records:[1]});initial();changes.length=0;
 const repeat=scope.exports.refresh();assert.equal(changes.length,0);await finish({records:[2]});assert.ok(changes.some(([k,v])=>k==='loaded'&&v.records[0]===2));repeat();changes.length=0;
 scope.session={id:'other'};const changed=scope.exports.refresh();assert.ok(changes.some(([k,v])=>k==='loaded'&&v===null));changed();changes.length=0;await finish({records:[3]});assert.equal(changes.length,0);
});
