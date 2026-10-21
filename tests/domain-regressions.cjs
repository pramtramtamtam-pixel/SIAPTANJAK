const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,runtime,account,reportBody}=require('./domain-harness.cjs');
async function withFixture(fn){const d=fixture();try{await fn(d);}finally{d.close();}}
const rejectsStatus=(promise,status)=>assert.rejects(promise,e=>e.status===status);

test('Partially configured planning dates load without losing the enabled stage',()=>withFixture(async d=>{
 const {wibInputDate,deriveSchedules}=runtime(d,account(d,'admin')).load('lib/planning-phases.ts');
 const stored={kabStart:'2026-10-16T08:05:00.000Z',forumStart:'2026-10-31T08:05:00.000Z',provinceStart:null,provinceEnd:null};
 const inputs=Object.fromEntries(Object.entries(stored).map(([key,value])=>[key,wibInputDate(value)]));
 assert.equal(inputs.kabStart,'2026-10-16T15:05');assert.equal(inputs.provinceStart,'');assert.equal(inputs.provinceEnd,'');
 const {schedules}=deriveSchedules(inputs,2027);assert.equal(schedules.length,1);assert.equal(schedules[0].closes,'2026-10-28T08:05:00.000Z');
 for(const value of [undefined,null,'','not-a-date'])assert.equal(wibInputDate(value),'');
}));

test('Editing the latest cumulative report synchronizes proposal and revision',()=>withFixture(async d=>{
 const rt=runtime(d,account(d,'company'));const b=reportBody(d);Object.assign(b.payload,{physical:100,amount:100});await rt.record('report',b);
 const p=d.prepare("SELECT status,progress,actual_amount,payload FROM usulan WHERE id='proposal'").get();assert.equal(p.status,'Selesai');assert.equal(p.progress,100);assert.equal(p.actual_amount,100);assert.equal(JSON.parse(p.payload).actual,100);assert.equal(d.prepare('SELECT COUNT(*) n FROM proposal_revisions').get().n,1);
}));
test('Archived reports cannot be reactivated by editing',()=>withFixture(async d=>{
 d.prepare("UPDATE records SET payload=json_set(payload,'$.deletedAt','archived') WHERE id='report'").run();await rejectsStatus(runtime(d,account(d,'company')).record('report',reportBody(d)),409);assert.equal(JSON.parse(d.prepare("SELECT payload FROM records WHERE id='report'").get().payload).deletedAt,'archived');
}));
test('Cancelled reports cannot be edited',()=>withFixture(async d=>{
 d.prepare("UPDATE records SET payload=json_set(payload,'$.cancelledAt','cancelled') WHERE id='report'").run();await rejectsStatus(runtime(d,account(d,'company')).record('report',reportBody(d)),409);
}));
test('Company cannot edit another company report',()=>withFixture(async d=>{await rejectsStatus(runtime(d,account(d,'other')).record('report',reportBody(d)),403);}));
test('Report physical percentage follows allowed choices',()=>withFixture(async d=>{const b=reportBody(d);b.payload.physical=42;await rejectsStatus(runtime(d,account(d,'company')).record('report',b),400);}));
test('Nonexistent dates are rejected',()=>withFixture(async d=>{const rt=runtime(d,account(d,'company')),b=reportBody(d);b.payload.actualEnd='2028-02-31';await rejectsStatus(rt.record('report',b),400);const {isIsoDate}=rt.load('lib/date-policy.ts');assert.equal(isIsoDate('2028-02-29'),true);assert.equal(isIsoDate('2027-02-29'),false);assert.equal(isIsoDate('2028-13-01'),false);}));
test('Unknown action cannot bypass proposal planning phase',()=>withFixture(async d=>{
 const rt=runtime(d,account(d,'district',2027));d.prepare("UPDATE usulan SET status='Draft',company_id=NULL WHERE id='proposal'").run();const p=d.prepare("SELECT * FROM usulan WHERE id='proposal'").get();const b={title:p.title,wilayah:p.wilayah,bidang:p.bidang,year:2028,budget:p.budget,status:'Diajukan',payload:JSON.parse(p.payload)};
 await rejectsStatus(rt.proposal('proposal',b),409);await rejectsStatus(rt.proposal('proposal',{...b,action:'unexpected-action'}),400);
}));
test('Commitment stores the activity year and clears previous cancellation markers',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET status='Disetujui POKJA Provinsi',company_id=NULL,payload=json_set(payload,'$.cancelledAt','old') WHERE id='proposal'").run();await runtime(d,account(d,'company',2027)).proposal('proposal',{action:'commit',amount:100,fullOutput:true,fullBeneficiaries:true,start:'2028-01-01',end:'2028-12-31',notes:'Komitmen contoh'});
 const p=JSON.parse(d.prepare("SELECT payload FROM records WHERE type='komitmen'").get().payload);assert.equal(p.year,2028);assert.equal(p.planningYear,2027);assert.equal(JSON.parse(d.prepare("SELECT payload FROM usulan WHERE id='proposal'").get().payload).cancelledAt,undefined);
}));
test('New company account receives an approved company profile atomically',()=>withFixture(async d=>{
 const rt=runtime(d,account(d,'admin',2027));const response=await rt.load('lib/user-service.ts').handleUserWrite(account(d,'admin',2027),undefined,{name:'New user',username:'newcompany',email:'',password:'Example123',instansi:'Company example',role:'Perusahaan',active:true});const {id}=await response.json();assert.equal(d.prepare('SELECT status FROM perusahaan WHERE user_id=?').get(id).status,'Disetujui');assert.equal(d.prepare('SELECT username FROM users WHERE id=?').get(id).username,'newcompany');
}));
test('Invalid password does not partially save account changes',()=>withFixture(async d=>{
 const admin=account(d,'admin',2027),rt=runtime(d,admin);await rejectsStatus(rt.load('lib/user-service.ts').handleUserWrite(admin,'company',{name:'Changed',username:'company',email:'company@example.test',password:'short',instansi:'Changed company',role:'Perusahaan',active:true}),400);assert.equal(d.prepare("SELECT name FROM users WHERE id='company'").get().name,'Test company');
}));
test('Converting an existing account to company creates missing profile',()=>withFixture(async d=>{
 const admin=account(d,'admin',2027),rt=runtime(d,admin);await rt.load('lib/user-service.ts').handleUserWrite(admin,'pd',{name:'PD',username:'pduser',email:'pd@example.test',instansi:'New company',role:'Perusahaan',active:true});assert.equal(d.prepare("SELECT COUNT(*) n FROM perusahaan WHERE user_id='pd'").get().n,1);
}));
test('Last active administrator cannot be deactivated',()=>withFixture(async d=>{
 const admin=account(d,'admin',2027),rt=runtime(d,admin);await rejectsStatus(rt.load('lib/user-service.ts').handleUserWrite(admin,'admin',{name:'Admin',username:'admin',email:'admin@example.test',instansi:'Admin',role:'Perusahaan',active:true}),400);assert.equal(d.prepare("SELECT role FROM users WHERE id='admin'").get().role,'Administrator');assert.equal(d.prepare("SELECT COUNT(*) n FROM perusahaan WHERE user_id='admin'").get().n,0);
}));
test('Cancelled report is excluded from assessment financials',()=>withFixture(async d=>{
 const {assessmentSources}=runtime(d,account(d,'province',2027)).load('lib/assessments.ts');const result=assessmentSources([{id:'x',type:'laporan',status:'Selesai',payload:{year:2026,amount:100,cancelledAt:'cancelled'}}],[],2026);assert.equal(result.actual,0);
}));
test('Cumulative edit cannot exceed the next report',()=>withFixture(async d=>{
 d.prepare("INSERT INTO records SELECT 'later',type,owner_id,usulan_id,title,status,json_set(payload,'$.physical',100,'$.amount',100),'2026-10-03' FROM records WHERE id='report'").run();const b=reportBody(d);b.payload.amount=150;await rejectsStatus(runtime(d,account(d,'company')).record('report',b),409);
}));
test('Editing an older report keeps parent equal to latest cumulative report',()=>withFixture(async d=>{
 d.prepare("INSERT INTO records SELECT 'later',type,owner_id,usulan_id,title,status,json_set(payload,'$.physical',100,'$.amount',100),'2026-10-03' FROM records WHERE id='report'").run();const b=reportBody(d);b.payload.amount=60;await runtime(d,account(d,'company')).record('report',b);assert.equal(d.prepare("SELECT progress FROM usulan WHERE id='proposal'").get().progress,100);assert.equal(d.prepare("SELECT actual_amount FROM usulan WHERE id='proposal'").get().actual_amount,100);
}));
test('Deleting the latest report restores prior cumulative totals',()=>withFixture(async d=>{
 d.prepare("INSERT INTO records SELECT 'earlier',type,owner_id,usulan_id,title,status,json_set(payload,'$.physical',33,'$.amount',33),'2026-10-01' FROM records WHERE id='report'").run();await runtime(d,account(d,'company')).record('report',{action:'delete-report',confirm:true});const p=d.prepare("SELECT progress,actual_amount FROM usulan WHERE id='proposal'").get();assert.equal(p.progress,33);assert.equal(p.actual_amount,33);
}));
test('Administrator cannot verify proposals',()=>withFixture(async d=>{await rejectsStatus(runtime(d,account(d,'admin',2027)).proposal('proposal',{action:'verify',stage:'Bappeda'}),403);}));
test('PD cannot verify another POKJA',()=>withFixture(async d=>{d.prepare("UPDATE usulan SET status='Menunggu Pembahasan POKJA',bidang='Pendidikan' WHERE id='proposal'").run();await rejectsStatus(runtime(d,account(d,'pd',2027)).proposal('proposal',{action:'verify',stage:'POKJA',status:'Disetujui POKJA Provinsi',confirm:true}),403);}));
test('Print fallback uses activity year N+1 and Bappeda can print verification',()=>withFixture(async d=>{const rt=runtime(d,account(d,'province',2027));const res=await rt.load('lib/print-report.ts').handlePrintReport(new Request('http://test/api/print-report?scope=usulan'),account(d,'province',2027));const result=await res.json();assert.equal(result.year,2028);assert.equal(result.proposals.length,1);}));
test('Print explicit year matches data year',()=>withFixture(async d=>{const u=account(d,'admin',2027),rt=runtime(d,u);const res=await rt.load('lib/print-report.ts').handlePrintReport(new Request('http://test/api/print-report?scope=laporan&reportYear=2026'),u);assert.equal((await res.json()).year,2026);}));

test('Selected dashboard planning year loads matching proposal year in workspace',()=>withFixture(async d=>{
 d.prepare("INSERT INTO usulan(id,owner_id,title,bidang,wilayah,year,budget,status,origin,payload,created) VALUES('historical','district','Historical','Infrastruktur','Ogan Ilir',2027,100,'Draft','Kab/Kota','{}','2026-01-01')").run();
 const rt=runtime(d,account(d,'district',2027));const response=await rt.load('app/api/[...path]/route.ts').GET(new Request('http://test/api/workspace?planningYear=2026'));assert.equal(response.status,200);const result=await response.json();assert.equal(result.viewPlanningYear,2026);assert.equal(result.usulan.length,1);assert.equal(result.usulan[0].id,'historical');assert.equal(result.user.planning_year,2027);
}));
test('API returns validation errors from extracted record handler',()=>withFixture(async d=>{
 const rt=runtime(d,account(d,'company'));const response=await rt.load('app/api/[...path]/route.ts').POST(new Request('http://test/api/records/report',{method:'POST',headers:{origin:'http://test','content-type':'application/json'},body:JSON.stringify({action:'invalid'})}));assert.equal(response.status,400);assert.match((await response.json()).error,/Tindakan laporan/);
}));
test('Multi-region report is visible to the second authorized district',()=>withFixture(async d=>{
 const u={...account(d,'district',2028),wilayah:'Palembang'};const rt=runtime(d,u),{visibleRecords}=rt.load('lib/access.ts');const report={id:'r',type:'laporan',payload:{year:2028,wilayah:'Ogan Ilir',wilayahs:['Ogan Ilir','Palembang']}};assert.equal(visibleRecords(u,[report],[]).length,1);assert.equal(visibleRecords({...u,wilayah:'Lahat'},[report],[]).length,0);
}));
test('Latest report calculation consistently excludes old and cancelled reports',()=>withFixture(async d=>{
 const {latestActiveReports}=runtime(d,account(d,'province')).load('lib/report-state.ts');const rows=[{id:'old',type:'laporan',status:'Selesai',usulan_id:'x',created:'2026-01-01',payload:{amount:50}},{id:'new',type:'laporan',status:'Selesai',usulan_id:'x',created:'2026-02-01',payload:{amount:100}},{id:'cancelled',type:'laporan',status:'Selesai',usulan_id:'x',created:'2026-03-01',payload:{amount:200,cancelledAt:'yes'}}];const latest=latestActiveReports(rows);assert.equal(latest.length,1);assert.equal(latest[0].id,'new');
}));
test('Rejected Bappeda proposal accepts owner correction attachment while phase 1 is open',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET status='Ditolak Bappeda Provinsi',company_id=NULL WHERE id='proposal'").run();d.prepare('DELETE FROM planning_schedules WHERE phase=2').run();d.prepare('UPDATE planning_schedules SET phase=0').run();const body=new FormData();body.set('usulanId','proposal');body.set('category','Data dukung lainnya');body.set('file',new Blob(['%PDF-1.4\nKoreksi data dukung\n%%EOF'],{type:'application/pdf'}),'koreksi.pdf');const rt=runtime(d,account(d,'district',2027));const response=await rt.load('lib/documents.ts').handleDocument(new Request('http://test/api/documents',{method:'POST',body}),account(d,'district',2027));assert.equal(response.status,200);assert.equal(d.prepare('SELECT COUNT(*) n FROM dokumen').get().n,1);
}));
test('District cannot upload corrections after phase 1 closes',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET status='Ditolak Bappeda Provinsi',company_id=NULL WHERE id='proposal'").run();const body=new FormData();body.set('usulanId','proposal');body.set('file',new Blob(['Koreksi data'],{type:'text/plain'}),'koreksi.txt');const u=account(d,'district',2027);await rejectsStatus(runtime(d,u).load('lib/documents.ts').handleDocument(new Request('http://test/api/documents',{method:'POST',body}),u),409);
}));
test('Rejected POKJA proposal stays locked for attachment editing',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET status='Ditolak POKJA Provinsi',company_id=NULL WHERE id='proposal'").run();d.prepare('DELETE FROM planning_schedules WHERE phase=2').run();d.prepare('UPDATE planning_schedules SET phase=0').run();const body=new FormData();body.set('usulanId','proposal');body.set('file',new Blob(['Koreksi data'],{type:'text/plain'}),'koreksi.txt');const u=account(d,'district',2027);await rejectsStatus(runtime(d,u).load('lib/documents.ts').handleDocument(new Request('http://test/api/documents',{method:'POST',body}),u),403);
}));
test('Assessment can be saved for the explicitly selected previous year',()=>withFixture(async d=>{
 const u=account(d,'province',2027),rt=runtime(d,u),criteria=rt.load('lib/assessment-criteria.ts').assessmentCriteria;const values=Object.fromEntries(criteria.map(c=>[c.id,{score:50,evidence:'Contoh bukti'}]));const res=await rt.load('lib/assessments.ts').handleAssessments(new Request('http://test/api/assessments',{method:'POST',body:JSON.stringify({year:2026,companyId:'c-company',action:'save',values,finance:{plan:100,actual:50}})}),u);assert.equal(res.status,200);assert.equal(d.prepare('SELECT year FROM company_assessments').get().year,2026);
}));
test('Continuation report retains identity when edited',()=>withFixture(async d=>{
 d.prepare("UPDATE records SET usulan_id=NULL,payload=json_set(payload,'$.year',2026,'$.completionRevokedAt','revoked','$.replacedBy','continuation') WHERE id='report'").run();const b=reportBody(d);b.usulanId='';Object.assign(b.payload,{year:2026,actualStart:'2026-01-01',actualEnd:'2026-10-01',previousReportId:'report',activityId:'report',sdgs:['6'],program:['pr']});delete b.payload.completionRevokedAt;delete b.payload.replacedBy;d.prepare("INSERT INTO records(id,type,owner_id,usulan_id,title,status,payload,created) VALUES('continuation','laporan','company',NULL,'Continued','Selesai',?,'2026-10-03')").run(JSON.stringify(b.payload));await runtime(d,account(d,'company',2027)).record('continuation',b);const p=JSON.parse(d.prepare("SELECT payload FROM records WHERE id='continuation'").get().payload);assert.equal(p.activityId,'report');assert.equal(p.previousReportId,'report');
}));

test('New linked report updates parent in the same transaction',()=>withFixture(async d=>{
 const b=reportBody(d);b.payload.physical=66;b.payload.amount=75;await runtime(d,account(d,'company')).record(undefined,b);const p=d.prepare("SELECT progress,actual_amount FROM usulan WHERE id='proposal'").get();assert.equal(p.progress,66);assert.equal(p.actual_amount,75);
}));
test('Removing the only report resets cumulative totals without cancelling commitment',()=>withFixture(async d=>{
 await runtime(d,account(d,'company')).record('report',{action:'delete-report',confirm:true});const p=d.prepare("SELECT progress,actual_amount,status,company_id FROM usulan WHERE id='proposal'").get();assert.equal(p.progress,0);assert.equal(p.actual_amount,0);assert.equal(p.status,'Dalam Pelaksanaan');assert.equal(p.company_id,'c-company');
}));
test('Only companies can create RKA',()=>withFixture(async d=>{await rejectsStatus(runtime(d,account(d,'admin',2027)).record(undefined,{type:'rencana_tjsl'}),403);}));
test('N+2 proposal is rejected when session is N',()=>withFixture(async d=>{await rejectsStatus(runtime(d,account(d,'district',2027)).proposal(undefined,{year:2029}),403);}));
test('POKJA rejection remains uneditable even during input phase',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET status='Ditolak POKJA Provinsi',company_id=NULL WHERE id='proposal'").run();d.prepare('DELETE FROM planning_schedules WHERE phase=2').run();d.prepare('UPDATE planning_schedules SET phase=0').run();await rejectsStatus(runtime(d,account(d,'district',2027)).proposal('proposal',{year:2028}),409);
}));
test('District cannot delete draft after its input phase closes',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET status='Draft',company_id=NULL WHERE id='proposal'").run();await rejectsStatus(runtime(d,account(d,'district',2027)).proposal('proposal',{action:'delete',confirm:true}),409);
}));
test('Commitment requires explicit agreement booleans',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET status='Disetujui POKJA Provinsi',company_id=NULL WHERE id='proposal'").run();await rejectsStatus(runtime(d,account(d,'company',2027)).proposal('proposal',{action:'commit',amount:100,fullOutput:'false',fullBeneficiaries:'false',start:'2028-01-01',end:'2028-12-31',notes:'Komitmen contoh'}),400);
}));
test('Authorized linked report remains visible on map without its out-of-region proposal',()=>withFixture(async d=>{
 const {monitoringMapData}=runtime(d,account(d,'district',2028)).load('lib/monitoring-map.ts');const report={id:'linked',usulan_id:'other-region',type:'laporan',status:'Selesai',title:'Regional realization',created:'2026-10-01',payload:{year:2028,wilayah:'Ogan Ilir',wilayahs:['Ogan Ilir','Palembang'],lat:-3,lng:104,physical:50}};const result=monitoringMapData([], [report], {wilayah:'Palembang'});assert.equal(result.length,1);assert.equal(result[0].mapLocationSource,'Lokasi laporan realisasi');
}));
test('Historical proposal print has matching planning year metadata',()=>withFixture(async d=>{
 const u=account(d,'province',2027),rt=runtime(d,u);const result=await (await rt.load('lib/print-report.ts').handlePrintReport(new Request('http://test/api/print-report?scope=usulan&year=2027'),u)).json();assert.equal(result.year,2027);assert.equal(result.planningYear,2026);
}));

test('Workspace no longer exposes cancelled institution office scenario',()=>withFixture(async d=>{
 const location={offices:[{type:'Kantor instansi',wilayah:'Ogan Ilir',lat:-3.2,lng:104.6,address:'SIMULASI'}]};
 d.prepare('INSERT INTO institution_offices(user_id,payload,updated) VALUES(?,?,?)').run('district',JSON.stringify(location),new Date().toISOString());
 d.prepare('INSERT INTO institution_offices(user_id,payload,updated) VALUES(?,?,?)').run('pd',JSON.stringify({offices:[{type:'Kantor PD',wilayah:'Palembang',lat:-3,lng:104.7}]}),new Date().toISOString());
 const rt=runtime(d,account(d,'district',2027)),response=await rt.load('app/api/[...path]/route.ts').GET(new Request('http://test/api/workspace?planningYear=2027'));
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.institutionOffice,undefined);
}));

test('Automatic assessment suggestions calculate finances and physical progress without inventing evidence',()=>withFixture(async d=>{
 const suggest=runtime(d,account(d,'province')).load('lib/assessment-recommendation.ts').assessmentRecommendation;
 const source={plan:200,actual:150,plans:[{id:'plan',payload:{target:10,sdgs:['6'],outcome:'Indikator',rab:{utama:200}}}],reports:[{id:'report',payload:{physical:100,scenario:true,safety:{procedure:true},outcome:'Klaim'}}]};
 const result=suggest(source,[{id:'doc',report_id:'report',category:'Laporan'},{id:'foreign-doc',report_id:'other',category:'Laporan'}],2028);
 assert.equal(result.score.scores.i1,75);assert.equal(result.values.i2.score,100);assert.equal(result.values.p2.score,100);assert.equal(result.values.p3.score,75);assert.equal(result.values.i4.score,0);assert.equal(result.values.r2.score,0);assert.equal(result.values.r1.score,0);assert.ok(result.reviewRequired.includes('r2'));assert.ok(!result.values.r2.evidence.includes('foreign-doc'));assert.equal(result.scenario,true);
}));

test('Empty assessment sources yield zero suggestions and retain review requirements',()=>withFixture(async d=>{
 const result=runtime(d,account(d,'province')).load('lib/assessment-recommendation.ts').assessmentRecommendation({plan:0,actual:0,plans:[],reports:[]},[],2028);
 assert.equal(result.score.total,0);assert.equal(Object.keys(result.values).length,11);assert.equal(result.reviewRequired.length,10);
}));

test('Assessment API returns live suggestions without saving or finalizing them',()=>withFixture(async d=>{
 const rt=runtime(d,account(d,'province',2028));const response=await rt.load('lib/assessments.ts').handleAssessments(new Request('http://test/api/assessments?year=2028'),account(d,'province',2028));assert.equal(response.status,200);const data=await response.json();assert.ok(data.recommendations);assert.ok(data.recommendations.company || Object.keys(data.recommendations).length>0);assert.equal(d.prepare('SELECT count(*) n FROM company_assessments').get().n,0);
}));

test('Assessment basis year can be selected independently from planning session and remains bounded',()=>withFixture(async d=>{
 const user=account(d,'province',2027),rt=runtime(d,user),handler=rt.load('lib/assessments.ts').handleAssessments;
 const response=await handler(new Request('http://test/api/assessments?year=2028'),user);assert.equal((await response.json()).year,2028);
 await rejectsStatus(handler(new Request('http://test/api/assessments?year=2099'),user),403);
 await rejectsStatus(handler(new Request('http://test/api/assessments?year=2023'),user),403);
}));

test('Standalone report stores SDGs and strategic programs and rejects missing or invalid selections',()=>withFixture(async d=>{
 const rt=runtime(d,account(d,'company',2027));const b=reportBody(d);b.usulanId='';Object.assign(b.payload,{year:2026,actualStart:'2026-01-01',actualEnd:'2026-10-01',program:['pr'],sdgs:['6','11']});
 for(const fields of [{sdgs:[]},{sdgs:['18']},{sdgs:['6','6']},{program:[]},{program:['unknown']},{program:['pr','pr']}])await rejectsStatus(rt.record(undefined,{...b,payload:{...b.payload,...fields}}),400);
 await rt.record(undefined,b);const p=JSON.parse(d.prepare("SELECT payload FROM records WHERE usulan_id IS NULL AND type='laporan'").get().payload);assert.deepEqual(p.sdgs,['6','11']);assert.deepEqual(p.program,['pr']);
}));
test('Followup report inherits verified alignment rather than client supplied choices',()=>withFixture(async d=>{
 const b=reportBody(d);b.payload.sdgs=['17'];b.payload.program=['unknown'];await runtime(d,account(d,'company')).record('report',b);const p=JSON.parse(d.prepare("SELECT payload FROM records WHERE id='report'").get().payload);assert.deepEqual(p.sdgs,[1]);assert.deepEqual(p.program,['pr']);
}));
test('Bappeda decision saves corrected alignment in payload relations review and revision',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET status='Menunggu Verifikasi Bappeda Provinsi',company_id=NULL WHERE id='proposal'").run();
 await runtime(d,account(d,'province',2027)).proposal('proposal',{action:'verify',stage:'Bappeda',status:'Menunggu Pembahasan POKJA',bidang:'Infrastruktur',program:['pr'],sdgs:['6','11']});
 const p=JSON.parse(d.prepare("SELECT payload FROM usulan WHERE id='proposal'").get().payload);assert.deepEqual(p.sdgs,['6','11']);assert.deepEqual(d.prepare('SELECT goal FROM usulan_sdgs ORDER BY goal').all().map(r=>r.goal),[6,11]);assert.equal(d.prepare('SELECT program_id FROM usulan_program').get().program_id,'pr');
 const checks=JSON.parse(d.prepare('SELECT checks FROM review_usulan').get().checks);assert.deepEqual(checks.sdgs,['6','11']);assert.deepEqual(checks.program,['pr']);
 const revision=JSON.parse(d.prepare('SELECT snapshot FROM proposal_revisions').get().snapshot);assert.deepEqual(revision.payload.sdgs,['6','11']);
}));
test('Bappeda rejects incomplete alignment without changing status or creating review',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET status='Menunggu Verifikasi Bappeda Provinsi',company_id=NULL WHERE id='proposal'").run();
 const rt=runtime(d,account(d,'province',2027)),b={action:'verify',stage:'Bappeda',status:'Ditolak Bappeda Provinsi',bidang:'Infrastruktur'};await rejectsStatus(rt.proposal('proposal',b),400);await rejectsStatus(rt.proposal('proposal',{...b,program:['not-a-program'],sdgs:['1']}),400);
 assert.equal(d.prepare('SELECT COUNT(*) n FROM review_usulan').get().n,0);assert.equal(d.prepare("SELECT status FROM usulan WHERE id='proposal'").get().status,'Menunggu Verifikasi Bappeda Provinsi');
}));
test('POKJA cannot replace alignment established by Bappeda',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET status='Menunggu Pembahasan POKJA',company_id=NULL WHERE id='proposal'").run();
 await runtime(d,account(d,'pd',2027)).proposal('proposal',{action:'verify',stage:'POKJA',status:'Disetujui POKJA Provinsi',confirm:true,program:['unknown'],sdgs:['17']});
 const p=JSON.parse(d.prepare("SELECT payload FROM usulan WHERE id='proposal'").get().payload);assert.deepEqual(p.sdgs,[1]);assert.deepEqual(p.program,['pr']);
}));
test('All seventeen SDGs provide descriptive hover titles',()=>withFixture(async d=>{
 const {sdgGoals,sdgTitle}=runtime(d,account(d,'admin')).load('lib/sdg-goals.ts');assert.equal(sdgGoals.length,17);assert.equal(sdgTitle('6'),'SDGs 6: Air Bersih dan Sanitasi Layak');assert.equal(sdgTitle('11'),'SDGs 11: Kota dan Permukiman yang Berkelanjutan');
}));


test('PD funding composition groups latest completed activities by company within active filters',()=>withFixture(async d=>{
 const {monitoringData,fundingByCompany}=runtime(d,account(d,'pd')).load('lib/monitoring-data.ts');
 const report=(id,owner,company,amount,bidang='Infrastruktur',year=2027,physical=100,created='2026-10-01')=>({id,type:'laporan',status:'Selesai',owner_id:owner,company_name:company,created,payload:{year,bidang,amount,physical,actualStart:year+'-01-01',actualEnd:year+'-10-01'}});
 const rows=[report('one','a','Company A',100),report('two','a','Company A',50),report('three','b','Company B',75),report('ongoing','b','Company B',900,'Infrastruktur',2027,50),report('other-pokja','b','Company B',1000,'Pendidikan'),report('other-year','a','Company A',500,'Infrastruktur',2026)];
 rows.push({...report('old','a','Company A',10),payload:{...rows[0].payload,activityId:'same'}},{...report('new','a','Company A',20,'Infrastruktur',2027,100,'2026-10-02'),payload:{...rows[0].payload,amount:20,activityId:'same'}});
 const data=monitoringData(rows,[],2027,'Infrastruktur');const f=fundingByCompany(data.entries);assert.equal(f.length,2);assert.equal(f[0].name,'Company A');assert.equal(f[0].value,170);assert.equal(f[1].value,75);assert.equal(f.reduce((n,v)=>n+v.value,0),data.actualAmount);
 const filtered=fundingByCompany(monitoringData(rows,[],2027,'Infrastruktur','b').entries);assert.equal(filtered.length,1);assert.equal(filtered[0].value,75);assert.equal(filtered[0].color,f[1].color);assert.equal(fundingByCompany([]).length,0);
}));

test('PD company colors are distinct and remain stable when filtering companies',()=>withFixture(async d=>{
 const {fundingByCompany}=runtime(d,account(d,'pd')).load('lib/monitoring-data.ts');const ids=Array.from({length:16},(_,i)=>'company-'+i),entries=ids.map(owner=>({owner,company:owner,kind:'Realisasi',payload:{amount:100}}));const all=fundingByCompany(entries,ids);assert.equal(new Set(all.map(v=>v.color)).size,16);for(const e of entries)assert.equal(fundingByCompany([e],ids)[0].color,all.find(v=>v.id===e.owner).color);
}));

test('Post Musrenbang runs automatically after provincial closing and stays open past year end',()=>withFixture(async d=>{
 const {effectivePlanningSchedules,postReportingOpen}=runtime(d,account(d,'province')).load('lib/planning-phases.ts');
 const rows=[{phase:2,enabled:0,opens:'2026-10-18T00:00:00.000Z',closes:'2026-12-31T16:59:59.000Z'}],events={provinceEnd:'2026-10-18T00:00:00.000Z'};
 assert.equal(postReportingOpen(rows,events,Date.parse('2026-10-17')),false);assert.equal(postReportingOpen(rows,events,Date.parse('2026-10-18T00:00:00.000Z')),true);assert.equal(postReportingOpen(rows,events,Date.parse('2029-01-01')),true);
 const s=effectivePlanningSchedules(rows,events)[0];assert.equal(s.manualEnabled,false);assert.equal(s.continuous,true);
}));
test('Manual post Musrenbang activation works without provincial closing date',()=>withFixture(async d=>{
 const {deriveSchedules,postReportingOpen}=runtime(d,account(d,'province')).load('lib/planning-phases.ts');
 const manual=deriveSchedules({},2027,true);assert.equal(manual.schedules.length,1);assert.equal(manual.schedules[0].phase,2);assert.equal(postReportingOpen([{...manual.schedules[0],enabled:1}],{}),true);assert.equal(postReportingOpen([{...manual.schedules[0],enabled:0}],{}),false);
 const late=deriveSchedules({provinceStart:'2027-05-01T10:00',provinceEnd:'2027-05-02T10:00'},2027);assert.equal(late.schedules[0].continuous,true);
}));
test('Planning API preserves unchecked automatic mode and exposes open reporting',()=>withFixture(async d=>{
 const u=account(d,'province',2027),rt=runtime(d,u),planning=rt.load('lib/planning.ts');
 await planning.handlePlanning(new Request('http://test/api/planning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({year:2027,events:{provinceEnd:'2020-01-01T10:00'},enabled:[false,false,false]})}),u);
 const result=await (await planning.handlePlanning(new Request('http://test/api/planning'),u)).json();assert.equal(result.postReportingOpen,true);assert.equal(result.schedules.find(s=>s.phase===2).manualEnabled,false);assert.equal(result.active.phase,2);
 assert.equal(d.prepare('SELECT enabled FROM planning_schedules WHERE phase=2').get().enabled,0);
}));
test('Manual post phase opens planning-year standalone reports but does not expand year ceiling',()=>withFixture(async d=>{
 const u=account(d,'province',2027),rt=runtime(d,u),planning=rt.load('lib/planning.ts');
 await planning.handlePlanning(new Request('http://test/api/planning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({year:2027,events:{},enabled:[false,false,true]})}),u);
 const options=rt.load('lib/report-options.ts');const clock=Date.parse('2026-10-01');assert.equal(options.isStandaloneReportYear(2027,2027,clock,false),false);assert.equal(options.isStandaloneReportYear(2027,2027,clock,true),true);assert.equal(options.isStandaloneReportYear(2028,2027,clock,true),false);
 const body=reportBody(d);body.usulanId='';Object.assign(body.payload,{year:2027,actualStart:'2027-01-01',actualEnd:'2027-10-01',program:['pr'],sdgs:['6']});await runtime(d,account(d,'company',2027)).record(undefined,body);
 const result=d.prepare("SELECT payload FROM records WHERE usulan_id IS NULL AND type='laporan'").get();assert.equal(JSON.parse(result.payload).year,2027);
}));
test('Automatic post phase does not open before provincial end and invalid chronology remains rejected',()=>withFixture(async d=>{
 const {deriveSchedules,postReportingOpen}=runtime(d,account(d,'province')).load('lib/planning-phases.ts');assert.throws(()=>deriveSchedules({provinceStart:'2027-05-02T10:00',provinceEnd:'2027-05-01T10:00'},2027,true));
 assert.equal(postReportingOpen([{phase:2,enabled:0,opens:'2026-01-01'}],{provinceEnd:'2100-01-01'}),false);
 assert.equal(postReportingOpen([{phase:2,enabled:0,opens:'2026-01-01'}],{provinceEnd:null}),false);
}));

test('Company can reopen its completed N+1 proposal from commitment page',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET status='Selesai',progress=100,actual_amount=100 WHERE id='proposal'").run();d.prepare("UPDATE records SET payload=json_set(payload,'$.physical',100,'$.amount',100) WHERE id='report'").run();
 await runtime(d,account(d,'company',2027)).proposal('proposal',{action:'reopen-completion',confirm:true});assert.equal(d.prepare("SELECT status FROM usulan WHERE id='proposal'").get().status,'Dalam Pelaksanaan');assert.equal(d.prepare("SELECT actual_amount FROM usulan WHERE id='proposal'").get().actual_amount,0);assert.equal(d.prepare("SELECT status FROM records WHERE id='report'").get().status,'Penyelesaian dibatalkan');
}));
test('Company can reopen historical completed proposal shown under same planning session',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET year=2027,status='Selesai',progress=100,actual_amount=100 WHERE id='proposal'").run();d.prepare("UPDATE records SET payload=json_set(payload,'$.year',2027,'$.physical',100) WHERE id='report'").run();await runtime(d,account(d,'company',2027)).proposal('proposal',{action:'reopen-completion',confirm:true});assert.equal(d.prepare("SELECT status FROM usulan WHERE id='proposal'").get().status,'Dalam Pelaksanaan');
}));
test('Report route uses same reopening rule for completed linked N+1 activity',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET status='Selesai',progress=100 WHERE id='proposal'").run();d.prepare("UPDATE records SET payload=json_set(payload,'$.physical',100) WHERE id='report'").run();await runtime(d,account(d,'company',2027)).record('report',{action:'reopen-completion',confirm:true});assert.equal(d.prepare("SELECT status FROM usulan WHERE id='proposal'").get().status,'Dalam Pelaksanaan');
}));
test('Reopening still rejects other company unconfirmed and unfinished activities',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET status='Selesai',progress=100 WHERE id='proposal'").run();d.prepare("UPDATE records SET payload=json_set(payload,'$.physical',100) WHERE id='report'").run();await rejectsStatus(runtime(d,account(d,'other',2027)).proposal('proposal',{action:'reopen-completion',confirm:true}),403);await rejectsStatus(runtime(d,account(d,'company',2027)).proposal('proposal',{action:'reopen-completion',confirm:false}),400);
 d.prepare("UPDATE records SET payload=json_set(payload,'$.physical',50) WHERE id='report'").run();await rejectsStatus(runtime(d,account(d,'company',2027)).proposal('proposal',{action:'reopen-completion',confirm:true}),409);
}));


test('Company can commit approved historical activity without changing planning session',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET year=2027,status='Disetujui POKJA Provinsi',company_id=NULL WHERE id='proposal'").run();
 await runtime(d,account(d,'company',2027)).proposal('proposal',{action:'commit',amount:100,fullOutput:true,fullBeneficiaries:true,start:'2027-02-01',end:'2027-11-30',notes:'Komitmen simulasi tahun pelaksanaan 2027'});
 const row=d.prepare("SELECT year,status,company_id FROM usulan WHERE id='proposal'").get();assert.equal(row.year,2027);assert.equal(row.status,'Dalam Pelaksanaan');assert.equal(row.company_id,'c-company');
}));
test('Company commitment still rejects activities beyond session N+1',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET year=2029,status='Disetujui POKJA Provinsi',company_id=NULL WHERE id='proposal'").run();
 await rejectsStatus(runtime(d,account(d,'company',2027)).proposal('proposal',{action:'commit',amount:100,fullOutput:true,fullBeneficiaries:true,start:'2029-02-01',end:'2029-11-30',notes:'Uji batas tahun'}),403);
}));

test('Linked report inherits proposal district even when submitted locations differ',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET year=2027 WHERE id='proposal'").run();const body=reportBody(d);body.payload.year=2027;body.payload.wilayah='Palembang';body.payload.wilayahs=['Palembang'];
 await runtime(d,account(d,'company',2027)).record(undefined,body);
 const row=d.prepare("SELECT payload FROM records WHERE type='laporan' AND id<>'report' ORDER BY created DESC LIMIT 1").get();const saved=JSON.parse(row.payload);assert.equal(saved.wilayah,'Ogan Ilir');assert.deepEqual(saved.wilayahs,['Ogan Ilir']);
}));

test('Phase print carries prior proposals forward and excludes later decisions',()=>withFixture(async d=>{
 const u=account(d,'province',2027),rt=runtime(d,u),planning=rt.load('lib/planning.ts');
 const base={...d.prepare("SELECT * FROM usulan WHERE id='proposal'").get(),payload:{}};
 for(const [phase,status] of [[0,'Draft'],[0,'Diajukan'],[1,'Menunggu Pembahasan POKJA'],[2,'Ditolak POKJA Provinsi']])await planning.revisionStatement(u,{...base,status},{phase},'Simulasi').run();
 const print=rt.load('lib/print-report.ts');
 for(const [phase,status] of [[0,'Diajukan'],[1,'Menunggu Pembahasan POKJA'],[2,'Ditolak POKJA Provinsi']]){
  const result=await(await print.handlePrintReport(new Request('http://test/api/print-report?scope=usulan&phase='+phase),u)).json();assert.equal(result.proposals.length,1);assert.equal(result.proposals[0].status,status);assert.equal(result.planningYear,2027);
 }
 d.prepare('DELETE FROM proposal_revisions WHERE phase>0').run();
 const carried=await(await print.handlePrintReport(new Request('http://test/api/print-report?scope=usulan&phase=1'),u)).json();assert.equal(carried.proposals[0].status,'Diajukan');
}));
test('Phase print does not invent history and keeps pre-deletion archive',()=>withFixture(async d=>{
 const u=account(d,'province',2027),rt=runtime(d,u),print=rt.load('lib/print-report.ts');
 const read=async()=>await(await print.handlePrintReport(new Request('http://test/api/print-report?scope=usulan&phase=0'),u)).json();assert.equal((await read()).proposals.length,0);
 const base={...d.prepare("SELECT * FROM usulan WHERE id='proposal'").get(),payload:{},status:'Draft'};await rt.load('lib/planning.ts').revisionStatement(u,base,{phase:0},'Draft').run();
 d.prepare("UPDATE usulan SET payload=json_set(payload,'$.deletedAt','2026-10-19') WHERE id='proposal'").run();assert.equal((await read()).proposals[0].status,'Draft');
}));

test('Workflow writes fail closed with disabled input and unopened automatic post stage',()=>withFixture(async d=>{
 d.prepare("UPDATE planning_schedules SET enabled=0,opens='2100-01-01'").run();const u=account(d,'province',2027),planning=runtime(d,u).load('lib/planning.ts');
 for(const action of ['verify-bappeda','verify-pokja','commit','decline','report','cancel-execution','reopen-completion'])await rejectsStatus(planning.requireWorkflowAction(u,action),409);
}));
test('POKJA is limited to stage two while reporting uses independent post switch',()=>withFixture(async d=>{
 d.prepare('DELETE FROM planning_schedules WHERE phase=2').run();d.prepare('UPDATE planning_schedules SET phase=0').run();const u=account(d,'province',2027),p=runtime(d,u).load('lib/planning.ts');
 assert.equal((await p.requireWorkflowAction(u,'verify-bappeda')).phase,0);await rejectsStatus(p.requireWorkflowAction(u,'verify-pokja'),409);await rejectsStatus(p.requireWorkflowAction(u,'commit'),409);await rejectsStatus(p.requireWorkflowAction(u,'report'),409);
 d.prepare("INSERT INTO planning_schedules(id,year,phase,opens,closes,enabled,updated_by,updated) VALUES('manual-post',2027,2,'2000-01-01','2100-01-01',1,'province','2026-10-19')").run();assert.equal((await p.requireWorkflowAction(u,'report')).phase,2);assert.equal((await p.activePhase(2027)).phase,0);
}));
test('Revision print preserves schedule captured before later settings changes',()=>withFixture(async d=>{
 const u=account(d,'province',2027),rt=runtime(d,u),p=rt.load('lib/planning.ts');const phase=await p.requireWorkflowAction(u,'verify-pokja');const base={...d.prepare("SELECT * FROM usulan WHERE id='proposal'").get(),payload:{}};
 await p.revisionStatement(u,base,phase,'Keputusan POKJA').run();d.prepare("UPDATE planning_schedules SET closes='2099-01-01' WHERE year=2027 AND phase=1").run();
 const result=await(await rt.load('lib/print-report.ts').handlePrintReport(new Request('http://test/api/print-report?scope=usulan&phase=1'),u)).json();assert.equal(result.scheduleSource,'archive');assert.equal(result.schedule.closes,'2100-01-01');assert.equal(result.proposals[0].workflowContext.actorId,u.id);
}));

test('Later planning sessions do not rewrite a prior planning-stage archive',()=>withFixture(async d=>{
 const u=account(d,'province',2027),rt=runtime(d,u),p=rt.load('lib/planning.ts'),base={...d.prepare("SELECT * FROM usulan WHERE id='proposal'").get(),payload:{}};
 await p.revisionStatement(u,{...base,status:'Disetujui POKJA Provinsi'},{phase:1},'Keputusan').run();await p.revisionStatement({...u,planning_year:2028},{...base,status:'Selesai'},{phase:2},'Pelaporan tahun berikutnya').run();
 const result=await(await rt.load('lib/print-report.ts').handlePrintReport(new Request('http://test/api/print-report?scope=usulan&phase=2'),u)).json();assert.equal(result.proposals[0].status,'Disetujui POKJA Provinsi');
}));

test('Stage two covers Musrenbang until its end with no transition gap',()=>withFixture(async d=>{
 const mod=runtime(d,account(d,'province',2027)).load('lib/planning-phases.ts');
 const result=mod.deriveSchedules({forumStart:'2026-10-19T08:00',provinceStart:'2026-10-20T08:00',provinceEnd:'2026-10-21T17:00'},2027);
 assert.equal(result.schedules.find(r=>r.phase===1).closes,result.schedules.find(r=>r.phase===2).opens);
 const effective=mod.effectivePlanningSchedules([{phase:1,opens:'2026-10-19',closes:'2026-10-20',enabled:1}],result.events);assert.equal(effective[0].closes,result.events.provinceEnd);
}));
test('Historical print authorizes snapshot scope after present POKJA reassignment',()=>withFixture(async d=>{
 const u=account(d,'pd',2027),rt=runtime(d,u),base={...d.prepare("SELECT * FROM usulan WHERE id='proposal'").get(),payload:{}};
 await rt.load('lib/planning.ts').revisionStatement(u,{...base,status:'Menunggu Pembahasan POKJA'},{phase:1},'Review').run();d.prepare("UPDATE usulan SET bidang='Pendidikan' WHERE id='proposal'").run();
 const result=await(await rt.load('lib/print-report.ts').handlePrintReport(new Request('http://test/api/print-report?scope=usulan&phase=1'),u)).json();assert.equal(result.proposals.length,1);assert.equal(result.proposals[0].bidang,'Infrastruktur');
}));
test('Reopened earlier stage uses last chronological revision for phase print',()=>withFixture(async d=>{
 const u=account(d,'province',2027),rt=runtime(d,u),p=rt.load('lib/planning.ts'),base={...d.prepare("SELECT * FROM usulan WHERE id='proposal'").get(),payload:{}};
 await p.revisionStatement(u,{...base,status:'Menunggu Pembahasan POKJA'},{phase:1},'Earlier').run();d.prepare("UPDATE proposal_revisions SET created='2026-10-01' ").run();await p.revisionStatement(u,{...base,status:'Draft'},{phase:0},'Reopened').run();
 const result=await(await rt.load('lib/print-report.ts').handlePrintReport(new Request('http://test/api/print-report?scope=usulan&phase=1'),u)).json();assert.equal(result.proposals[0].status,'Draft');
}));
test('Linked N+1 report accepted while standalone N+1 remains unavailable',()=>withFixture(async d=>{
 const u=account(d,'company',2027),rt=runtime(d,u);await rt.record('report',reportBody(d));assert.equal(JSON.parse(d.prepare("SELECT payload FROM records WHERE id='report'").get().payload).year,2028);
 const body=reportBody(d);body.usulanId='';body.payload.program=['pr'];body.payload.sdgs=['6'];await rejectsStatus(rt.record(undefined,body),403);
}));
test('RKA deletion is blocked and keeps original financial information',()=>withFixture(async d=>{
 d.prepare("INSERT INTO records(id,type,owner_id,title,status,payload,created) VALUES('plan','rencana_tjsl','company','RKA','Terencana','{\"year\":2027,\"amount\":123}','2026-10-01')").run();
 await rejectsStatus(runtime(d,account(d,'company',2027)).record('plan',{action:'delete-plan',confirm:true}),409);const row=d.prepare("SELECT * FROM records WHERE id='plan'").get();assert.equal(row.status,'Terencana');assert.equal(JSON.parse(row.payload).amount,123);assert.equal(JSON.parse(row.payload).deletedAt,undefined);
}));
test('Shared action policy keeps browser gate consistent with stage and independent reporting',()=>withFixture(async d=>{
 const m=runtime(d,account(d,'province',2027)).load('lib/planning-phases.ts');assert.equal(m.workflowActionGate({active:{phase:0},postReportingOpen:true},'commit').enabled,false);assert.equal(m.workflowActionGate({active:{phase:0},postReportingOpen:true},'report').enabled,true);assert.equal(m.workflowActionGate({active:{phase:1,enabled:1,opens:'2000-01-01',closes:'2100-01-01'},postReportingOpen:false},'verify-pokja').enabled,true);assert.equal(m.workflowActionGate(null,'commit').enabled,false);
}));

function companyProfileRequest(overrides={}){return {name:'Contact Company',username:'company',email:'company@example.test',companyName:'Updated Company',jenis:'BUMN',signer_name:'Director',signer_position:'Direktur',companyProfile:{nib:'1234567890123',pic:'PIC Baru',phone:'08123456789',offices:[{type:'Kantor pusat',address:'Jalan kantor',provinsi:'Sumatera Selatan',wilayah:'Palembang',lat:-2.97,lng:104.75}]},...overrides};}
test('Company profile synchronizes identity contacts offices and preserves approval',()=>withFixture(async d=>{
 d.prepare("UPDATE perusahaan SET payload=? WHERE id='c-company'").run(JSON.stringify({demo:true,logoId:'existing-logo',emailVerified:true,operasional:'stale',latOperasional:-3,lngOperasional:104}));
 const u=account(d,'company',2027),rt=runtime(d,u),body=companyProfileRequest();await rt.load('lib/profiles.ts').handleProfile(new Request('http://test/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),u);
 const user=d.prepare("SELECT * FROM users WHERE id='company'").get(),c=d.prepare("SELECT * FROM perusahaan WHERE id='c-company'").get(),p=JSON.parse(c.payload),profile=d.prepare("SELECT * FROM user_profiles WHERE user_id='company'").get();assert.equal(user.instansi,c.name);assert.equal(c.name,body.companyName);assert.equal(p.pic,'PIC Baru');assert.equal(profile.phone,p.phone);assert.equal(profile.pic_name,p.pic);assert.equal(p.offices.length,1);assert.equal(p.operasional,undefined);assert.equal(p.logoId,'existing-logo');assert.equal(c.status,'Disetujui');assert.equal(user.role,'Perusahaan');assert.equal(p.demo,true);
 const get=await(await rt.load('lib/profiles.ts').handleProfile(new Request('http://test/api/profile'),u)).json();assert.equal(get.company.payload.pic,'PIC Baru');
}));
test('Invalid company address rejects profile without partial account update',()=>withFixture(async d=>{
 const u=account(d,'company',2027),body=companyProfileRequest();body.companyProfile.offices[0].lat=90;await rejectsStatus(runtime(d,u).load('lib/profiles.ts').handleProfile(new Request('http://test/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),u),400);assert.equal(d.prepare("SELECT name FROM users WHERE id='company'").get().name,u.name);assert.equal(d.prepare("SELECT name FROM perusahaan WHERE id='c-company'").get().name,'Company company');
}));
test('Noncompany cannot inject company identity into personal profile',()=>withFixture(async d=>{
 const u=account(d,'district',2027);await rejectsStatus(runtime(d,u).load('lib/profiles.ts').handleProfile(new Request('http://test/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(companyProfileRequest({email:u.email,username:u.username}))}),u),403);
}));

function rkaBody(year=2027,bidang='Infrastruktur'){return {type:'rencana_tjsl',title:'Rencana satu POKJA',payload:{year,bidang,amount:100,target:'100',unit:'Orang',start:year+'-01-01',end:year+'-12-01'}};}
test('One active RKA per company POKJA and year, with existing plan editable',()=>withFixture(async d=>{
 const rt=runtime(d,account(d,'company',2027)),body=rkaBody();await rt.record(undefined,body);await rejectsStatus(rt.record(undefined,rkaBody()),409);
 const row=d.prepare("SELECT * FROM records WHERE type='rencana_tjsl'").get();const edit=rkaBody();edit.payload.amount=250;await rt.record(row.id,edit);assert.equal(JSON.parse(d.prepare('SELECT payload FROM records WHERE id=?').get(row.id).payload).amount,250);
 await runtime(d,account(d,'other',2027)).record(undefined,rkaBody());await rt.record(undefined,rkaBody(2025));assert.equal(d.prepare("SELECT COUNT(*) n FROM records WHERE type='rencana_tjsl'").get().n,3);
}));
test('Existing RKA cannot change its POKJA',()=>withFixture(async d=>{
 const rt=runtime(d,account(d,'company',2027));await rt.record(undefined,rkaBody());d.prepare("INSERT INTO master(id,type,name,active) VALUES('social','bidang','Sosial',1)").run();const id=d.prepare("SELECT id FROM records WHERE type='rencana_tjsl'").get().id;await rejectsStatus(rt.record(id,rkaBody(2027,'Sosial')),409);
}));

test('RKA beneficiary target follows selected POKJA and excludes archived records',()=>withFixture(async d=>{
 const sum=runtime(d,account(d,'company',2027)).load('lib/report-state.ts').activityBeneficiaries;
 const rows=[{payload:{bidang:'Infrastruktur',target:100,beneficiaries:999}},{payload:{bidang:'Sosial',target:250}},{payload:{bidang:'Infrastruktur',target:50}},{payload:{bidang:'Infrastruktur',target:500,deletedAt:'archived'}}];
 assert.equal(sum(rows,'plan','Infrastruktur'),150);assert.equal(sum(rows,'plan','Sosial'),250);assert.equal(sum(rows,'plan'),400);assert.equal(sum(rows,'plan','Pendidikan'),0);assert.equal(sum([{payload:{target:0,beneficiaries:99}}],'plan'),0);
}));

test('Alignment recap counts latest active activities once per support and selected year',()=>withFixture(async d=>{
 const fn=runtime(d,account(d,'province',2027)).load('lib/alignment-summary.ts').alignmentSummary;
 const report=(id,created,amount,extra={})=>({id,type:'laporan',status:'Selesai',usulan_id:'p1',created,payload:{year:2027,amount,program:['pr','pr'],sdgs:['6','6','11'],...extra}});
 const rows=[report('old','2026-01-01',10),report('new','2026-02-01',100),report('archived','2026-03-01',900,{completionRevokedAt:'archive'}),report('other-year','2026-04-01',500,{year:2028}),{...report('mandiri','2026-02-01',50,{program:['other'],sdgs:['6']}),usulan_id:null}];
 const result=fn(rows,[],[{id:'pr',type:'program',name:'Program 1'},{id:'other',type:'program',name:'Program 2'}],2027);assert.equal(result.activityCount,2);assert.equal(result.amount,150);assert.equal(result.programs[0].count,1);assert.equal(result.programs[0].amount,100);assert.equal(result.sdgs.find(r=>r.id==='6').count,2);assert.equal(result.sdgs.find(r=>r.id==='6').amount,150);assert.equal(result.sdgs.find(r=>r.id==='11').amount,100);assert.equal(result.sdgs.length,17);
}));
test('Alignment recap inherits missing historical linked alignment and keeps zero rows',()=>withFixture(async d=>{
 const fn=runtime(d,account(d,'province',2027)).load('lib/alignment-summary.ts').alignmentSummary;
 const result=fn([{id:'r',type:'laporan',status:'Selesai',usulan_id:'p',created:'2026-01-01',payload:{year:2027,amount:25}}],[{id:'p',payload:{program:['pr'],sdgs:[1]}}],[{id:'pr',type:'program',name:'Program'}],2027);assert.equal(result.programs[0].amount,25);assert.equal(result.sdgs[0].count,1);assert.equal(result.sdgs[1].count,0);
}));

test('Print dashboard renders valid proposal snapshot and safely handles missing data',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const filename=path.resolve(__dirname,'../app/PrintDashboard.tsx'),exports={};const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,require:n=>n==='../lib/data'?{money:n=>'Rp '+n}:n==='../lib/pokja-colors'?{pokjaColor:()=>'red'}:n==='./ActivityDashboard'?{activeSummaryRows:r=>r,activityStatus:()=>''}:require(n)});
 const Component=exports.default;assert.equal(renderToStaticMarkup(React.createElement(Component,{})),'');assert.equal(renderToStaticMarkup(React.createElement(Component,{snapshot:null})), '');
 const html=renderToStaticMarkup(React.createElement(Component,{snapshot:{scope:'usulan',title:'Verifikasi Usulan',filters:[['Tahun','2028']],summary:[['Jumlah usulan',1]],proposals:[{id:'one'}]}}));assert.match(html,/Dashboard Verifikasi Usulan/);assert.match(html,/Tahun: 2028/);assert.match(html,/Jumlah usulan pada tab dan filter aktif: 1/);
});

test('Phase Excel uses exactly print snapshot data with numeric budgets and literal text',()=>withFixture(async d=>{
 const convert=runtime(d,account(d,'province',2027)).load('lib/phase-excel.ts').phaseExcelData;
 const result={planningYear:2027,name:'Tahap Pembahasan',generated:'2026-10-19T01:00:00Z',proposals:[{id:'one',title:'=SUM(A1:A2)',year:2028,budget:100000,status:'Ditolak Bappeda Provinsi',payload:{}}]};const excel=convert(result,'Verifikasi',2028,'1');assert.equal(excel.details.length,1);assert.equal(excel.details[0]['Estimasi biaya (Rp)'],100000);assert.equal(excel.details[0]['Nama kegiatan'],'=SUM(A1:A2)');assert.equal(excel.statuses[0].Status,'Ditolak');assert.equal(excel.metadata.find(r=>r[0]==='Tahapan')[1],'Tahap 2 · Tahap Pembahasan');assert.equal(convert({...result,proposals:[]},'Verifikasi',2028,'1').details.length,0);
}));

test('Public homepage summarizes completed activities and unique supporting companies',()=>withFixture(async d=>{
 const sum=runtime(d,account(d,'province',2027)).load('lib/public-summary.ts').publicSummary;
 const p=[{id:'p',status:'Selesai',company_id:'c1',payload:{beneficiaries:999}},{id:'ongoing',status:'Dalam Pelaksanaan',company_id:'c2',payload:{beneficiaries:100}}];
 const r=(id,created,n,extra={})=>({id,type:'laporan',status:'Selesai',owner_id:'u1',usulan_id:'p',created,payload:{physical:100,beneficiaries:n,...extra}});
 const rows=[r('old','2026-01-01',5),r('new','2026-02-01',10),{...r('own','2026-03-01',20),usulan_id:null},r('archive','2026-04-01',500,{completionRevokedAt:'x'})];
 const result=sum(p,rows,[{id:'c1',user_id:'u1'},{id:'c2',user_id:'u2'}],6);assert.equal(result.completed,2);assert.equal(result.supportingCompanies,1);assert.equal(result.beneficiaries,30);assert.equal(result.pokjaCount,6);
}));

test('Manual stages can be scheduled together while closed and enabled independently',()=>withFixture(async d=>{
 const u=account(d,'province',2027),rt=runtime(d,u),p=rt.load('lib/planning.ts');
 const events={kabStart:'2026-10-10T08:00',kabEnd:'2026-10-21T17:00',forumStart:'2026-10-10T08:00',forumEnd:'2026-10-25T17:00'};
 const save=enabled=>p.handlePlanning(new Request('http://test/api/planning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({year:2027,events,enabled})}),u);
 await save([false,false,false]);assert.equal(d.prepare('SELECT COUNT(*) n FROM planning_schedules WHERE year=2027 AND phase IN(0,1) AND enabled=0').get().n,2);
 await save([false,true,false]);assert.equal(d.prepare('SELECT enabled FROM planning_schedules WHERE year=2027 AND phase=0').get().enabled,0);assert.equal(d.prepare('SELECT enabled FROM planning_schedules WHERE year=2027 AND phase=1').get().enabled,1);
}));
test('Second stage does not require any first-stage date to be saved',()=>withFixture(async d=>{
 const rt=runtime(d,account(d,'province',2027)),m=rt.load('lib/planning-phases.ts');const result=m.deriveSchedules({forumStart:'2026-11-01T08:00',forumEnd:'2026-11-09T17:00'},2027);assert.equal(result.schedules.length,1);assert.equal(result.schedules[0].phase,1);assert.throws(()=>m.deriveSchedules({kabStart:'2026-11-05T08:00',kabEnd:'2026-11-04T17:00'},2027));
}));
test('Overlapping manually enabled stages allow the applicable action rather than first-stage priority',()=>withFixture(async d=>{
 d.prepare("INSERT INTO planning_schedules(id,year,phase,opens,closes,enabled,updated_by,updated) VALUES('kab',2027,0,'2000-01-01','2100-01-01',1,'province','2026-10-20')").run();const u=account(d,'pd',2027),rt=runtime(d,u),p=rt.load('lib/planning.ts');assert.equal((await p.requireWorkflowAction(u,'verify-pokja')).phase,1);
}));

test('Registration welcome email personalizes company and confirmation without password or WhatsApp instruction',()=>withFixture(async d=>{
 const make=runtime(d,account(d,'company',2027)).load('lib/registration-email.ts').registrationWelcomeEmail;const email=make({name:'PT Contoh',payload:{pic:'Ibu Kontak',password:'never-share-this',offices:[{type:'Kantor pusat',address:'Jalan Contoh',wilayah:'Palembang'}]}},'https://example.test/?token=test');assert.match(email,/Ibu Kontak/);assert.match(email,/PT Contoh/);assert.match(email,/Jalan Contoh, Palembang/);assert.match(email,/https:\/\/example.test/);assert.match(email,/siaptanjak@gmail.com/);assert.doesNotMatch(email,/never-share-this|wa.me|WhatsApp|Screenshoot/);
}));

test('Email settings are restricted to Administrator and reject stale edits',()=>withFixture(async d=>{
 const rt=runtime(d,account(d,'admin')),settings=rt.load('lib/email-template.ts').emailSettingsDefaults;
 const handle=rt.load('lib/email-settings.ts').handleEmailSettings;
 const req=(version,body=settings)=>new Request('http://localhost/api/email-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings:body,version})});
 await rejectsStatus(handle(new Request('http://localhost/api/email-settings'),null),401);
 await rejectsStatus(handle(new Request('http://localhost/api/email-settings'),account(d,'province')),403);
 const first=await (await handle(req(0),account(d,'admin'))).json();assert.equal(first.version,1);
 await rejectsStatus(handle(req(0),account(d,'admin')),409);
 await rejectsStatus(handle(req(1,{...settings,body:'Tanpa tautan'}),account(d,'admin')),400);
 const updated=await (await handle(req(1,{...settings,subject:'Selamat datang {{nama_perusahaan}}'}),account(d,'admin'))).json();assert.equal(updated.version,2);
 assert.equal(d.prepare('SELECT COUNT(*) n FROM email_settings').get().n,1);
}));
test('Email template validates sender account and renders variables without recursively expanding user data',()=>withFixture(async d=>{
 const rt=runtime(d,account(d,'admin')),{validateEmailSettings}=rt.load('lib/email-settings.ts');
 const {emailSettingsDefaults,renderEmail,registrationEmailValues}=rt.load('lib/email-template.ts');
 assert.throws(()=>validateEmailSettings({...emailSettingsDefaults,fromEmail:'other@gmail.com'},'siaptanjak@gmail.com'));
 assert.throws(()=>validateEmailSettings({...emailSettingsDefaults,subject:'Judul\nBcc: other@gmail.com'}));
 assert.throws(()=>validateEmailSettings({...emailSettingsDefaults,body:'{{tidak_dikenal}} {{tautan_konfirmasi}}'}));
 const values=registrationEmailValues({name:'PT {{tautan_konfirmasi}}',payload:{pic:'Kontak',offices:[{address:'Jalan satu',wilayah:'Palembang'}]}},'https://example.test/confirm',emailSettingsDefaults);
 const output=renderEmail('{{nama_perusahaan}}: {{tautan_konfirmasi}}',values);assert.equal(output,'PT {{tautan_konfirmasi}}: https://example.test/confirm');
}));

test('Registration queues the saved subject and body with an individual confirmation token',()=>withFixture(async d=>{
 const rt=runtime(d,account(d,'admin')),{emailSettingsDefaults}=rt.load('lib/email-template.ts');
 const settings={...emailSettingsDefaults,subject:'Pendaftaran {{nama_perusahaan}}',body:'Yth {{nama_kontak}}, {{nama_perusahaan}}: {{tautan_konfirmasi}}. Kontak {{email_bantuan}}'};
 d.prepare("INSERT INTO email_settings(id,payload,version,updated) VALUES('registration',?,1,'now')").run(JSON.stringify(settings));
 await rt.load('lib/registration-services.ts').queueConfirmation(new Request('http://localhost:3000/api/auth/register'),'company','company@example.test',true);
 const row=d.prepare('SELECT subject,message,status FROM email_outbox').get();
 assert.equal(row.subject,'Pendaftaran Company company');assert.match(row.message,/Company company/);assert.match(row.message,/page=konfirmasi-email&token=/);assert.ok(!row.message.includes('{{'));assert.equal(row.status,'Menunggu');
 assert.equal(d.prepare('SELECT COUNT(*) n FROM email_confirmations').get().n,1);
}));

test('Company cannot decline proposals through the API',()=>withFixture(async d=>{
 const before=d.prepare('SELECT COUNT(*) n FROM keputusan_perusahaan').get().n;
 await rejectsStatus(runtime(d,account(d,'company',2027)).proposal('proposal',{action:'decline',notes:'Tidak dipilih'}),403);
 assert.equal(d.prepare('SELECT COUNT(*) n FROM keputusan_perusahaan').get().n,before);
}));
test('District owner can edit a pending Bappeda proposal only while input is open',()=>withFixture(async d=>{
 d.prepare("INSERT INTO planning_schedules(id,year,phase,opens,closes,enabled,updated_by,updated) VALUES('input',2027,0,'2000-01-01','2100-01-01',1,'province','now')").run();
 d.prepare("UPDATE usulan SET status='Menunggu Verifikasi Bappeda Provinsi',company_id=NULL WHERE id='proposal'").run();
 const user=account(d,'district',2027),rt=runtime(d,user),canEdit=rt.load('lib/workflow.ts').canEditProposal;
 const row=d.prepare("SELECT * FROM usulan WHERE id='proposal'").get();
 assert.equal(canEdit(user,row),true);assert.equal(canEdit({...user,id:'someone-else'},row),false);
 const body={title:'Usulan diperbaiki pengusul',wilayah:row.wilayah,year:2028,budget:150,status:row.status,payload:{...JSON.parse(row.payload),program:['pr'],sdgs:['1']}};
 await rt.proposal('proposal',body);
 assert.equal(d.prepare("SELECT title FROM usulan WHERE id='proposal'").get().title,body.title);
 assert.equal(d.prepare("SELECT status FROM usulan WHERE id='proposal'").get().status,'Menunggu Verifikasi Bappeda Provinsi');
 d.prepare("UPDATE planning_schedules SET enabled=0 WHERE id='input'").run();
 await rejectsStatus(rt.proposal('proposal',body),409);
 d.prepare("UPDATE planning_schedules SET enabled=1 WHERE id='input'").run();
 d.prepare("UPDATE usulan SET status='Menunggu Pembahasan POKJA' WHERE id='proposal'").run();
 assert.equal(canEdit(user,d.prepare("SELECT * FROM usulan WHERE id='proposal'").get()),false);
 await rejectsStatus(rt.proposal('proposal',body),409);
}));

test('Cloud document links allow HTTPS file/folder links and reject executable or local addresses',()=>withFixture(async d=>{
 const {cloudDocumentUrl,cloudDocumentUrls}=runtime(d,account(d,'district')).load('lib/cloud-document-links.ts');
 assert.equal(cloudDocumentUrl('https://drive.google.com/drive/folders/abc'),'https://drive.google.com/drive/folders/abc');
 assert.equal(cloudDocumentUrls('https://drive.google.com/file/d/a/view\nhttps://drive.google.com/file/d/a/view').length,1);
 for(const url of ['javascript:alert(1)','file:///C:/data','http://drive.google.com/a','https://localhost/a','https://127.0.0.1/a','https://user:pass@drive.google.com/a','https://[::1]/a'])assert.throws(()=>cloudDocumentUrl(url));
}));
test('District and PD owners can save cloud support links with ownership and stage enforcement',()=>withFixture(async d=>{
 d.prepare("INSERT INTO planning_schedules(id,year,phase,opens,closes,enabled,updated_by,updated) VALUES('input',2027,0,'2000-01-01','2100-01-01',1,'province','now')").run();
 d.prepare("UPDATE usulan SET company_id=NULL,status='Menunggu Verifikasi Bappeda Provinsi' WHERE id='proposal'").run();
 const request=()=>new Request('http://localhost/api/documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usulanId:'proposal',url:'https://drive.google.com/drive/folders/support',category:'Proposal',name:'Folder data dukung'})});
 let rt=runtime(d,account(d,'district',2027));await rt.load('lib/documents.ts').handleDocument(request(),account(d,'district',2027));
 assert.equal(d.prepare('SELECT external_url,size FROM dokumen').get().external_url,'https://drive.google.com/drive/folders/support');
 await rejectsStatus(rt.load('lib/documents.ts').handleDocument(request(),account(d,'other',2027)),403);
 d.prepare("UPDATE usulan SET status='Menunggu Pembahasan POKJA' WHERE id='proposal'").run();
 await rejectsStatus(rt.load('lib/documents.ts').handleDocument(request(),account(d,'district',2027)),403);
 d.prepare("UPDATE usulan SET owner_id='pd',origin='Provinsi',status='Draft' WHERE id='proposal'").run();
 rt=runtime(d,account(d,'pd',2027));await rt.load('lib/documents.ts').handleDocument(request(),account(d,'pd',2027));
}));
test('Company report cloud attachments reject other owners and archived reports',()=>withFixture(async d=>{
 const user=account(d,'company',2027),rt=runtime(d,user),handle=rt.load('lib/report-documents.ts').handleReportDocument;
 const request=()=>new Request('http://localhost/api/report-documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reportId:'report',url:'https://drive.google.com/file/d/report/view',category:'Laporan',name:'Laporan kegiatan'})});
 await handle(request(),user);await handle(request(),user);
 assert.equal(d.prepare('SELECT COUNT(*) n FROM report_documents').get().n,1);
 await rejectsStatus(handle(request(),account(d,'other',2027)),403);
 d.prepare("UPDATE records SET payload=json_set(payload,'$.cancelledAt','now') WHERE id='report'").run();
 await rejectsStatus(handle(request(),user),409);
}));

test('CAPTCHA remains required for local and production login despite old bypass flags',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
 const source=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../lib/registration-services.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 function load(enabled){const exports={};vm.runInNewContext(source,{exports,URL,Response,require:n=>n==='cloudflare:workers'?{env:{localManualLoginMode:()=>enabled}}:n==='./server'?{assert:(v,m)=>{if(!v)throw Error(m);}}:{}});return exports;}
 const enabled=load(true),disabled=load(false);
 await assert.rejects(enabled.verifyRobot(new Request('http://localhost:3000/api/auth/login'),{}),/Konfirmasi bahwa Anda bukan robot/);
 await assert.rejects(enabled.verifyRobot(new Request('https://app.example.com/api/auth/login'),{bypass:true}));
 await assert.rejects(enabled.verifyRobot(new Request('http://localhost:3000/api/auth/register'),{}));
 await assert.rejects(disabled.verifyRobot(new Request('http://localhost:3000/api/auth/login'),{bypass:true}));
});

test('Company report Excel uses selected rows, numeric financials and only owned attachments',()=>withFixture(async d=>{
 const convert=runtime(d,account(d,'company')).load('lib/report-excel.ts').reportExcelData;
 const rows=[{id:'own',owner_id:'company',title:'=SUM(A1)',payload:{year:2028,amount:125000000,physical:100,beneficiaries:25},displayStatus:'Selesai'},{id:'other',owner_id:'other',payload:{year:2028,amount:9}},{id:'old',owner_id:'company',payload:{year:2027,amount:7}}];
 const docs=[{id:'doc',report_id:'own',name:'Laporan',external_url:'https://drive.google.com/file/d/report/view'},{id:'private',report_id:'other',name:'Other'}];
 const result=convert(rows,docs,'company',2028,[['POKJA','Infrastruktur']],'http://localhost:3000');
 assert.equal(result.details.length,1);assert.equal(result.details[0]['Realisasi pendanaan (Rp)'],125000000);assert.equal(result.details[0]['Judul kegiatan'],'=SUM(A1)');assert.equal(result.attachments.length,1);assert.match(result.attachments[0].Tautan,/drive.google.com/);assert.equal(convert([],docs,'company',2028,[]).details.length,0);
}));

test('Realization chart tooltip contains activity details and excludes plan-only rows',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../app/MonitoringOverview.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>n==='../lib/data'?{money:n=>'Rp '+n}:n==='../lib/pokja-colors'?{pokjaColor:()=> '#123456'}:require(n)});
 const entries=[{id:'r',title:'Sarana air bersih',company:'PT Contoh',owner:'one',theme:'Infrastruktur',kind:'Realisasi',source:'Tindak lanjut usulan',payload:{amount:82500000,physical:100,beneficiaries:100,wilayah:'Ogan Ilir'}},{id:'p',title:'RAHASIA RENCANA SAJA',theme:'Infrastruktur',kind:'Rencana',payload:{amount:165000000}}];
 const html=renderToStaticMarkup(React.createElement(exports.default,{data:{entries,actualAmount:82500000,actualCount:1,ongoingCount:0},onTheme:()=>{},onKind:()=>{}}));
 assert.match(html,/role="tooltip"/);assert.match(html,/Sarana air bersih/);assert.match(html,/PT Contoh/);assert.match(html,/Ogan Ilir/);assert.match(html,/82500000/);assert.ok(!html.includes('RAHASIA RENCANA SAJA'));
});

test('Audit pagination validates limits and returns stable nonoverlapping SQL pages',()=>withFixture(async d=>{
 const rt=runtime(d,account(d,'admin')),{readAuditPage}=rt.load('lib/audit-page.ts');
 for(let i=0;i<65;i++)d.prepare('INSERT INTO audit_log(id,user_id,action,entity,created) VALUES(?,?,?,?,?)').run(String(i).padStart(3,'0'),'admin',i===2?'Cari 100%':'Aktivitas','Objek','2026-10-20');
 const first=await readAuditPage(new URLSearchParams('page=1&limit=25')),second=await readAuditPage(new URLSearchParams('page=2&limit=25'));
 assert.equal(first.rows.length,25);assert.equal(first.pagination.total,65);assert.equal(first.pagination.pages,3);assert.ok(!first.rows.some(a=>second.rows.some(b=>a.id===b.id)));
 assert.equal((await readAuditPage(new URLSearchParams('query=100%25'))).rows.length,1);
 await rejectsStatus(readAuditPage(new URLSearchParams('limit=1000')),400);await rejectsStatus(readAuditPage(new URLSearchParams('page=-1')),400);
}));

test('Monitoring chart status filter keeps plan and realization values aligned with displayed activities',()=>withFixture(async d=>{
 const {monitoringData}=runtime(d,account(d,'company',2027)).load('lib/monitoring-data.ts');
 const records=[{id:'plan',type:'rencana_tjsl',owner_id:'company',title:'RKA',payload:{year:2027,bidang:'Infrastruktur',amount:100,start:'2027-01-01',end:'2027-12-31'}},{id:'done',type:'laporan',status:'Selesai',owner_id:'company',title:'Selesai',payload:{year:2027,bidang:'Infrastruktur',amount:60,physical:100}},{id:'ongoing',type:'laporan',status:'Selesai',owner_id:'company',title:'Berjalan',payload:{year:2027,bidang:'Infrastruktur',amount:20,physical:50}}];
 for(const [status,amount,count] of [['Rencana',100,1],['Berjalan',20,1],['Realisasi',60,1],['',180,3]]){const result=monitoringData(records,[],'2027','Infrastruktur','company','',status);assert.equal(result.entries.length,count);assert.equal(result.entries.reduce((n,r)=>n+Number(r.payload.amount),0),amount);}
}));

test('RKA headline budget and count use only the filtered timeline rows, including zero matches',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../app/ActivityDashboard.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Intl,Date,require:n=>n==='../lib/data'?{money:n=>'Rp '+n}:n==='../lib/pokja-colors'?{pokjaColor:()=> '#123456'}:n==='../lib/report-state'?{latestActiveReports:r=>r,activityBeneficiaries:()=>0}:require(n)});
 const rows=[{id:'one',owner_id:'company',payload:{amount:100,bidang:'Infrastruktur'}},{id:'two',owner_id:'company',payload:{amount:250,bidang:'Pendidikan'}}];
 function metrics(summaryRows){const html=renderToStaticMarkup(React.createElement(exports.default,{rows,summaryRows,mode:'plan',theme:'Infrastruktur',onTheme:()=>{},status:'',onStatus:()=>{}}));return html.split('class="activity-charts"')[0];}
 assert.match(metrics([rows[0]]),/Rp 100/);assert.ok(!metrics([rows[0]]).includes('Rp 350'));assert.match(metrics([rows[0]]),/Rencana kegiatan<\/small><strong>1<\/strong>/);assert.match(metrics([]),/Rp 0/);assert.match(metrics([]),/Rencana kegiatan<\/small><strong>0<\/strong>/);
});


test('Print phases enforce company district PD and management permissions on the server',()=>withFixture(async d=>{
 for(const [id,allowed] of [['company',['2']],['district',['0']],['pd',['1']],['province',['0','1','2']],['admin',['0','1','2']]]){
  const u=account(d,id,2027),handler=runtime(d,u).load('lib/print-report.ts').handlePrintReport;
  for(const phase of ['all','0','1','2','legacy0']){
   const call=()=>handler(new Request('http://test/api/print-report?scope=usulan&phase='+phase),u);
   if(phase==='all'||allowed.includes(phase)||phase==='legacy0'&&['admin','province'].includes(id))assert.equal((await call()).status,200);else await rejectsStatus(call(),403);
  }
 }
}));
test('PIC uses proposer before commitment, company after commitment and proposer again after release',()=>withFixture(async d=>{
 d.prepare("INSERT INTO user_profiles(user_id,phone,updated) VALUES('district','081111','now')").run();
 d.prepare("INSERT INTO user_profiles(user_id,phone,updated) VALUES('pd','082222','now')").run();
 d.prepare("UPDATE perusahaan SET payload=? WHERE id='c-company'").run(JSON.stringify({pic:'PIC Perusahaan',phone:'083333'}));
 const u=account(d,'province',2027),handler=runtime(d,u).load('lib/proposal-contact.ts').handleProposalContact;
 const contact=async()=> (await(await handler(new Request('http://test/api/proposal-contact/proposal'),u,'proposal')).json()).contact;
 assert.equal((await contact()).phone,'083333');assert.equal((await contact()).kind,'perusahaan');
 d.prepare("UPDATE usulan SET company_id=NULL,status='Disetujui POKJA Provinsi' WHERE id='proposal'").run();assert.equal((await contact()).phone,'081111');assert.equal((await contact()).kind,'pengusul');
 d.prepare("UPDATE usulan SET owner_id='pd',origin='Provinsi' WHERE id='proposal'").run();assert.equal((await contact()).phone,'082222');
}));
test('PIC endpoint denies other companies committed proposals, future years and archived proposals',()=>withFixture(async d=>{
 const u=account(d,'other',2027),handler=runtime(d,u).load('lib/proposal-contact.ts').handleProposalContact,req=new Request('http://test/api/proposal-contact/proposal');
 await rejectsStatus(handler(req,u,'proposal'),403);
 d.prepare("UPDATE usulan SET company_id=NULL,status='Disetujui POKJA Provinsi' WHERE id='proposal'").run();const res=await handler(req,u,'proposal');assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'private, no-store');assert.equal((await res.json()).contact.phone,'');
 d.prepare("UPDATE usulan SET year=2029 WHERE id='proposal'").run();await rejectsStatus(handler(req,u,'proposal'),403);
 d.prepare("UPDATE usulan SET year=2028,payload=? WHERE id='proposal'").run(JSON.stringify({deletedAt:'now'}));await rejectsStatus(handler(req,u,'proposal'),403);
}));


test('Alternate phase-report endpoint uses the same role restrictions',()=>withFixture(async d=>{
 for(const [id,phase] of [['company',0],['district',2],['pd',0]]){
  const u=account(d,id,2027);await rejectsStatus(runtime(d,u).load('lib/planning.ts').handlePhaseReport(new Request('http://test/api/phase-report?phase='+phase),u),403);
 }
}));


test('District and provincial PD save separate PIC identity and expose it on proposal details',()=>withFixture(async d=>{
 d.prepare("UPDATE usulan SET company_id=NULL,status='Disetujui POKJA Provinsi' WHERE id='proposal'").run();
 for(const id of ['district','pd']){
  const u=account(d,id,2027),rt=runtime(d,u),name='PIC '+id,phone=id==='district'?'08111111111':'+628222222222';
  const body={name:u.name,email:u.email,username:id==='pd'?'pd-user':u.username,instansi:u.instansi,pic_name:name,phone,signer_name:'Pejabat '+id,signer_position:'Kepala'};
  await rt.load('lib/profiles.ts').handleProfile(new Request('http://test/api/profile',{method:'POST',body:JSON.stringify(body)}),u);
  const profile=(await(await rt.load('lib/profiles.ts').handleProfile(new Request('http://test/api/profile'),u)).json()).profile;assert.equal(profile.pic_name,name);assert.equal(profile.phone,phone);assert.equal(profile.signer_name,'Pejabat '+id);assert.equal(d.prepare('SELECT name FROM users WHERE id=?').get(id).name,u.name);
  d.prepare("UPDATE usulan SET owner_id=? WHERE id='proposal'").run(id);
  const viewer=account(d,'company',2027),contact=(await(await rt.load('lib/proposal-contact.ts').handleProposalContact(new Request('http://test/api/proposal-contact/proposal'),viewer,'proposal')).json()).contact;assert.equal(contact.name,name);assert.equal(contact.phone,phone);assert.equal(contact.kind,'pengusul');
 }
 d.prepare("UPDATE usulan SET company_id='c-company',status='Dalam Pelaksanaan' WHERE id='proposal'").run();d.prepare("UPDATE perusahaan SET payload=? WHERE id='c-company'").run(JSON.stringify({pic:'PIC perusahaan',phone:'08333333333'}));const viewer=account(d,'company',2027),rt=runtime(d,viewer),contact=(await(await rt.load('lib/proposal-contact.ts').handleProposalContact(new Request('http://test/api/proposal-contact/proposal'),viewer,'proposal')).json()).contact;assert.equal(contact.name,'PIC perusahaan');assert.equal(contact.phone,'08333333333');
}));
test('PIC validation prevents partial profile updates and legacy callers preserve stored PIC',()=>withFixture(async d=>{
 const u=account(d,'district',2027),rt=runtime(d,u),handle=rt.load('lib/profiles.ts').handleProfile,request=body=>new Request('http://test/api/profile',{method:'POST',body:JSON.stringify({name:u.name,email:u.email,username:u.username,instansi:u.instansi,...body})});
 await handle(request({pic_name:'PIC lama',phone:'08123456789'}),u);
 for(const changes of [{pic_name:'',phone:'0812'},{pic_name:'PIC baru',phone:''},{pic_name:'x'.repeat(201),phone:'08123456789'},{pic_name:'PIC baru',phone:'1'.repeat(51)}])await rejectsStatus(handle(request({name:'Should not save',...changes}),u),400);
 assert.equal(d.prepare("SELECT name FROM users WHERE id='district'").get().name,u.name);assert.equal(d.prepare("SELECT pic_name FROM user_profiles WHERE user_id='district'").get().pic_name,'PIC lama');
 await handle(request({name:'Nama tampilan baru'}),u);const profile=d.prepare("SELECT * FROM user_profiles WHERE user_id='district'").get();assert.equal(profile.pic_name,'PIC lama');assert.equal(profile.phone,'08123456789');
}));
test('Institution PIC migration preserves existing phone and signature records',()=>withFixture(async d=>{
 const fs=require('node:fs'),path=require('node:path');d.exec('ALTER TABLE user_profiles DROP COLUMN pic_name');d.prepare("INSERT INTO user_profiles(user_id,signer_name,signer_nip,signer_position,phone,updated) VALUES('district','Pejabat','123','Kepala','08123456789','before')").run();const before=d.prepare('SELECT * FROM user_profiles').get();d.exec(fs.readFileSync(path.join(__dirname,'../drizzle/0018_institution_pic.sql'),'utf8'));const after=d.prepare('SELECT * FROM user_profiles').get();assert.equal(after.pic_name,'');delete after.pic_name;assert.deepEqual(after,before);
}));
