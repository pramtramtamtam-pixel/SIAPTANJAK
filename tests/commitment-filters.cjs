const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const cache={};function load(file){const full=path.resolve(__dirname,'..',file);if(cache[full])return cache[full];const exports={};cache[full]=exports;const js=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(js,{exports,require:name=>name.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(full),name+(fs.existsSync(path.resolve(path.dirname(full),name+'.ts'))?'.ts':'.tsx')))):require(name),Intl,Map,Array,Number,Math});return exports;}
const filters=load('lib/commitment-filters.ts'),base=filters.emptyCommitmentFilters,office=filters.companyOfficeOptions({offices:[{type:'Kantor pusat',wilayah:'Palembang',lat:-3,lng:104} ]})[0];
const proposals=[{budget:85000000,payload:{lat:-3.2,lng:104}},{budget:402500000,payload:{lat:-5,lng:104}}],budgetLimits=filters.commitmentLimits(proposals,office);
test('Haversine distance is zero at the selected office',()=>assert.equal(filters.distanceKm(office,office),0));
test('Haversine distance gives about 111.2 km per latitude degree',()=>assert.ok(Math.abs(filters.distanceKm({lat:0,lng:104},{lat:1,lng:104})-111.195)<.01));
test('Blank, absent, or invalid coordinates are not treated as zero',()=>{for(const value of [{},{lat:'',lng:104},{lat:null,lng:104},{lat:NaN,lng:104},{lat:91,lng:104}])assert.equal(filters.coordinates(value),null);assert.equal(filters.coordinates({lat:0,lng:0}).lat,0);});
test('Office dropdown contains separate single office choices',()=>{const values=filters.companyOfficeOptions({offices:[{type:'Kantor pusat',lat:-3,lng:104},{type:'Kantor operasional',lat:-4,lng:105}]});assert.equal(values.length,2);assert.notEqual(values[0].key,values[1].key);});
test('Invalid office coordinates are excluded from available choices',()=>{const options=filters.companyOfficeOptions({offices:[{type:'Kantor pusat',lat:'',lng:''},{type:'Kantor operasional',lat:-3,lng:104}]});assert.equal(options.length,1);assert.equal(options[0].key,'1');});
test('Legacy office fields remain supported',()=>assert.equal(filters.companyOfficeOptions({pusat:'Alamat',latPusat:-3,lngPusat:104}).length,1));
test('Default filters retain every proposal, including missing coordinates',()=>assert.equal(filters.matchesCommitmentFilters({budget:100,payload:{}},undefined,base),true));
test('Radius uses only the selected office and includes the radius boundary',()=>{const p={budget:100,payload:{lat:-3,lng:104}},far={...office,lat:-4};assert.equal(filters.matchesCommitmentFilters(p,office,{...base,radiusKm:0}),true);assert.equal(filters.matchesCommitmentFilters(p,far,{...base,radiusKm:50}),false);const distance=filters.proposalDistance(p,far);assert.equal(filters.matchesCommitmentFilters(p,far,{...base,radiusKm:distance}),true);});
test('Missing proposal coordinates are excluded only while radius is active',()=>{const p={budget:100,payload:{}};assert.equal(filters.matchesCommitmentFilters(p,office,{...base,radiusKm:50}),false);assert.equal(filters.matchesCommitmentFilters(p,office,base),true);});
test('Budget maximum is inclusive, and supports zero',()=>{assert.equal(filters.matchesCommitmentFilters({budget:100},office,{...base,maxBudget:100}),true);assert.equal(filters.matchesCommitmentFilters({budget:101},office,{...base,maxBudget:100}),false);assert.equal(filters.matchesCommitmentFilters({budget:1},office,{...base,maxBudget:0}),false);});
test('Radius and budget filters must both match',()=>{const p={budget:200,payload:{lat:-3,lng:104}};assert.equal(filters.matchesCommitmentFilters(p,office,{...base,radiusKm:20,maxBudget:100}),false);assert.equal(filters.matchesCommitmentFilters(p,office,{...base,radiusKm:20,maxBudget:200}),true);});
test('Sliders use actual activity cost and distance bounds',()=>{assert.equal(budgetLimits.radiusMin,filters.proposalDistance(proposals[0],office));assert.equal(budgetLimits.radiusMax,filters.proposalDistance(proposals[1],office));assert.equal(budgetLimits.budgetMin,85000000);assert.equal(budgetLimits.budgetMax,402500000);});
test('UI renders a shared budget track with accessible minimum and maximum handles',()=>{const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),Component=load('app/CompanyCommitmentFilters.tsx').default;const options=filters.companyOfficeOptions({offices:[{type:'Kantor pusat',lat:-3,lng:104},{type:'Kantor operasional',lat:-4,lng:105}]});const html=renderToStaticMarkup(React.createElement(Component,{offices:options,value:base,proposals,onApply:()=>{}}));assert.equal((html.match(/type="range"/g)||[]).length,3);assert.equal((html.match(/type="number"/g)||[]).length,0);assert.ok(html.includes('Kantor pusat'));assert.ok(html.includes('Pilih kantor di peta'));assert.ok(!html.includes('<select'));assert.ok(!html.includes('multiple=""'));assert.ok(html.includes('Terapkan'));assert.ok(html.includes('Terdekat'));assert.ok(html.includes('Terjauh'));assert.equal((html.match(/class="budget-range-track"/g)||[]).length,1);assert.ok(html.includes('Biaya minimum'));assert.ok(html.includes('Biaya maksimum'));assert.ok(html.includes('min="85000000"'));assert.ok(html.includes('max="402500000"'));});

function stagedPanel(){
 let states=[],cursor=0;const applied=[];
 const source=path.resolve(__dirname,'../app/CompanyCommitmentFilters.tsx'),exports={};
 const js=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(js,{exports,require:name=>name==='react'?{useState:initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];}}:name.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(source),name+(fs.existsSync(path.resolve(path.dirname(source),name+'.ts'))?'.ts':'.tsx')))):require(name),Intl,Math,Number});
 const options=filters.companyOfficeOptions({offices:[{type:'Kantor pusat',lat:-3,lng:104},{type:'Kantor operasional',lat:-4,lng:105}]});
 const render=()=>{cursor=0;return exports.default({offices:options,value:base,proposals,onApply:value=>applied.push(value)});};
 function find(predicate,node){if(arguments.length===1)node=render();if(node&&typeof node==='object'){if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const result=find(predicate,child);if(result)return result;}}}
 return {applied,find};
}
test('Moving sliders and choosing office does not apply until Terapkan is clicked',()=>{
 const panel=stagedPanel();panel.find(n=>n.type==='input'&&n.props.id==='commitment-radius').props.onChange({target:{value:'75'}});panel.find(n=>n.type==='input'&&n.props.id==='commitment-budget').props.onChange({target:{value:'200000000'}});assert.equal(panel.applied.length,0);
 panel.find(n=>n.type==='button'&&[n.props.children].flat().includes('Terapkan')).props.onClick();assert.equal(panel.applied.length,1);assert.equal(panel.applied[0].radiusKm,75);assert.equal(panel.applied[0].maxBudget,200000000);assert.equal(panel.applied[0].officeKey,'0');
});
test('Applying blank budgets preserves unbounded budget filtering',()=>{const panel=stagedPanel();panel.find(n=>n.type==='button'&&[n.props.children].flat().includes('Terapkan')).props.onClick();assert.equal(panel.applied[0].radiusKm,budgetLimits.radiusMax);assert.equal(panel.applied[0].maxBudget,null);});
test('Radius is clamped while explicit budget bounds are preserved',()=>{const draft=filters.commitmentDraft({officeKey:'1',radiusKm:0,maxBudget:999999999999},budgetLimits);assert.equal(draft.radiusKm,budgetLimits.radiusMin);assert.equal(draft.maxBudget,999999999999);});

test('An empty proposal list has no invented budget range',()=>{const limits=filters.commitmentLimits([]);assert.equal(limits.hasBudgets,false);assert.equal(filters.commitmentDraft(base,limits).maxBudget,null);});
test('A single cost uses the same minimum and maximum',()=>{const limits=filters.commitmentLimits([{budget:123456789}]);assert.equal(limits.budgetMin,123456789);assert.equal(limits.budgetMax,123456789);});
test('Malformed estimates do not change the valid budget range',()=>{const limits=filters.commitmentLimits([{budget:null},{budget:''},{budget:NaN},{budget:85000000},{budget:402500000}]);assert.equal(limits.budgetMin,85000000);assert.equal(limits.budgetMax,402500000);});
test('Popup uses native modal top layer and Escape closes it',()=>{
 const source=path.resolve(__dirname,'../app/CompanyFilterDialog.tsx'),exports={},effects=[];let ref,closed=0;
 const js=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(js,{exports,document:{body:{}},require:name=>name==='react'?{useRef:()=>ref={current:null},useEffect:callback=>effects.push(callback)}:name==='react-dom'?{createPortal:node=>node}:require(name)});
 const tree=exports.default({children:'Filters',onClose:()=>closed++});let shown=0,hidden=0;ref.current={open:false,showModal(){shown++;this.open=true;},close(){hidden++;this.open=false;}};const cleanup=effects[0]();assert.equal(tree.type,'dialog');assert.equal(shown,1);
 let prevented=false;tree.props.onCancel({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(closed,1);cleanup();assert.equal(hidden,1);
});

test('Changing office recomputes nearest and farthest activity distance',()=>{const other={...office,lat:-4,lng:105};const limits=filters.commitmentLimits(proposals,other);const distances=proposals.map(p=>filters.proposalDistance(p,other));assert.equal(limits.radiusMin,Math.min(...distances));assert.equal(limits.radiusMax,Math.max(...distances));assert.notEqual(limits.radiusMax,budgetLimits.radiusMax);});
test('Maximum radius preserves exact distance and includes farthest activity',()=>{const draft=filters.commitmentDraft(base,budgetLimits);assert.equal(draft.radiusKm,budgetLimits.radiusMax);assert.equal(filters.matchesCommitmentFilters(proposals[1],office,draft),true);});
test('No valid locations leaves radius inactive',()=>{const limits=filters.commitmentLimits([{payload:{lat:'',lng:''}}],office);assert.equal(limits.hasDistances,false);assert.equal(filters.commitmentDraft(base,limits).radiusKm,null);});
test('Map office selection is staged until Apply',()=>{const panel=stagedPanel();panel.find(n=>n.type==='button'&&n.props['aria-haspopup']==='dialog').props.onClick();const picker=panel.find(n=>typeof n.type==='function'&&n.props.selectedKey==='0');assert.ok(picker);picker.props.onChoose({key:'1',type:'Kantor operasional',lat:-4,lng:105,address:'',wilayah:''});assert.equal(panel.applied.length,0);panel.find(n=>n.type==='button'&&[n.props.children].flat().includes('Terapkan')).props.onClick();assert.equal(panel.applied[0].officeKey,'1');assert.notEqual(panel.applied[0].radiusKm,budgetLimits.radiusMax);});

test('Custom map reference survives draft normalization and drives distance calculation',()=>{const custom=filters.customReferenceOffice({lat:-4.25,lng:104.75});assert.ok(custom);const value={...base,officeKey:custom.key,customOffice:custom};assert.equal(filters.selectedReferenceOffice([office],value),custom);const limits=filters.commitmentLimits(proposals,custom),draft=filters.commitmentDraft(value,limits);assert.equal(draft.customOffice,custom);assert.equal(draft.radiusKm,Math.max(...proposals.map(p=>filters.proposalDistance(p,custom))));assert.equal(filters.customReferenceOffice({lat:100,lng:104}),null);});
test('Choosing a new map point remains staged until Apply',()=>{const panel=stagedPanel();panel.find(n=>n.type==='button'&&n.props['aria-haspopup']==='dialog').props.onClick();const picker=panel.find(n=>typeof n.type==='function'&&n.props.selectedKey==='0');const custom=filters.customReferenceOffice({lat:-3.7,lng:104.4});picker.props.onChoose(custom);assert.equal(panel.applied.length,0);panel.find(n=>n.type==='button'&&[n.props.children].flat().includes('Terapkan')).props.onClick();assert.equal(panel.applied[0].customOffice,custom);assert.equal(panel.applied[0].officeKey,custom.key);});


test('Inclusive budget range supports zero, independent bounds, and rejects inversion',()=>{
 const match=(budget,minBudget,maxBudget)=>filters.matchesCommitmentFilters({budget},undefined,{...base,minBudget,maxBudget});
 assert.equal(match(100,100,200),true);assert.equal(match(200,100,200),true);assert.equal(match(99,100,200),false);assert.equal(match(201,100,200),false);assert.equal(match(0,0,0),true);assert.equal(match(250,100,null),true);assert.equal(match(100,null,200),true);assert.equal(match(150,200,100),false);
});
test('Budget sliders stage inclusive bounds and prevent handles from crossing',()=>{
 const panel=stagedPanel();const move=(id,value)=>panel.find(n=>n.type==='input'&&n.props.id===id).props.onChange({target:{value}});
 move('commitment-budget-min','100000000');move('commitment-budget','200000000');assert.equal(panel.applied.length,0);
 panel.find(n=>n.type==='button'&&[n.props.children].flat().includes('Terapkan')).props.onClick();assert.equal(panel.applied[0].minBudget,100000000);assert.equal(panel.applied[0].maxBudget,200000000);
 move('commitment-budget-min','250000000');assert.equal(panel.find(n=>n.props?.id==='commitment-budget-min').props.value,200000000);
 move('commitment-budget','90000000');assert.equal(panel.find(n=>n.props?.id==='commitment-budget').props.value,200000000);
});
test('Several regions and themes combine with AND across filters, OR within selections',()=>{
 const {matchesProposalChoices:match,sortProposalBudget:sort}=load('lib/proposal-list-filters.ts');
 assert.equal(match({wilayah:'A',bidang:'X'},['A','B'],['X','Y']),true);assert.equal(match({wilayah:'B',bidang:'Y'},['A','B'],['X','Y']),true);assert.equal(match({wilayah:'C',bidang:'Y'},['A','B'],['X','Y']),false);assert.equal(match({wilayah:'A',bidang:'Z'},['A','B'],['X','Y']),false);assert.equal(match({wilayah:'A',bidang:'Z'},[],[]),true);
 const rows=[{budget:100},{budget:2},{budget:30}];assert.deepEqual(Array.from(sort(rows,'asc'),r=>r.budget),[2,30,100]);assert.deepEqual(Array.from(sort(rows,'desc'),r=>r.budget),[100,30,2]);assert.equal(rows[0].budget,100);
});


test('Distance ordering covers all rows before pagination and places unknown coordinates last',()=>{
 const {sortProposalDistance:sort}=load('lib/proposal-list-filters.ts');const rows=[{id:'far',payload:{lat:-4,lng:104}},{id:'missing',payload:{}},{id:'near',payload:{lat:-3.1,lng:104}},{id:'zero',payload:{lat:-3,lng:104}},{id:'bad',payload:{lat:'',lng:104}}];
 assert.deepEqual(Array.from(sort(rows,'asc',office),r=>r.id),['zero','near','far','missing','bad']);assert.deepEqual(Array.from(sort(rows,'desc',office),r=>r.id),['far','near','zero','missing','bad']);assert.equal(rows[0].id,'far');assert.equal(sort(rows,'asc',undefined),rows);assert.equal(sort(rows,'',office),rows);
});
test('Changing reference office recomputes proximity while equal distances preserve original order',()=>{
 const {sortProposalDistance:sort}=load('lib/proposal-list-filters.ts');const rows=[{id:'A',payload:{lat:-3,lng:104}},{id:'B',payload:{lat:-4,lng:104}},{id:'C',payload:{lat:-4,lng:104}}];
 assert.deepEqual(Array.from(sort(rows,'asc',office),r=>r.id),['A','B','C']);assert.deepEqual(Array.from(sort(rows,'asc',{...office,lat:-4}),r=>r.id),['B','C','A']);
});
