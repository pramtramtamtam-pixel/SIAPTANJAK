type ReportPayload = {
    deletedAt?: unknown;
    completionRevokedAt?: unknown;
    cancelledAt?: unknown;
    replacedBy?: unknown;
    activityId?: string;
};
type ReportRow = {
    id: string;
    type?: string;
    status?: string;
    usulan_id?: string | null;
    created?: string;
    payload?: ReportPayload;
};
/** An active report is a submitted cumulative value, without an archive marker. */
export function isActiveReport(row: ReportRow) {
    const p = row.payload || {};
    return row.type === 'laporan' && row.status === 'Selesai' && !p.deletedAt && !p.completionRevokedAt && !p.cancelledAt && !p.replacedBy;
}
export function reportActivityKey(row: ReportRow) {
    return row.usulan_id ? 'usulan:' + row.usulan_id : 'activity:' + (row.payload?.activityId || row.id);
}
export function latestActiveReports<T extends ReportRow>(rows: T[]): T[] {
    const latest = new Map<string, T>();
    for (const row of rows.filter(isActiveReport).sort((a, b) => String(b.created).localeCompare(String(a.created)) || String(b.id).localeCompare(String(a.id)))) {
        const key = reportActivityKey(row);
        if (!latest.has(key)) latest.set(key, row);
    }
    return [...latest.values()];
}
export function recordCoversRegion(payload: {wilayah?: unknown; wilayahs?: unknown} | null | undefined, region: string, fallback?: string) {
    return payload?.wilayah === region || Array.isArray(payload?.wilayahs) && payload.wilayahs.includes(region) || !payload?.wilayah && fallback === region;
}

/** Sum the selected activity targets; counts represent reported targets, not unique people. */
export function activityBeneficiaries(rows:any[],mode:string,theme=''){
 return rows.filter(r=>(!theme||r.payload?.bidang===theme)&&!r.payload?.deletedAt&&!r.payload?.cancelledAt&&!r.payload?.completionRevokedAt&&!r.payload?.replacedBy).reduce((total,r)=>{
  const p=r.payload||{},value=Number(mode==='plan'?(p.target??p.beneficiaries??0):(p.beneficiaries??0));
  return total+(Number.isFinite(value)&&value>=0?value:0);
 },0);
}
