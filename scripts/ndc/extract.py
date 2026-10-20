import json, sys, os, glob, re, html
PENDING = {'Analysis in progress', 'No Document Submitted', 'n/a', 'N/A', '', 'Not Specified', 'No specified measure', 'Not applicable', 'Not Applicable'}
MIT = {'m_energy': 'energy', 'm_transport': 'transport', 'm_buildings': 'buildings', 'm_industries': 'industry', 'm_agriculture': 'agriculture', 'm_lulucf': 'land-forests', 'm_waste': 'waste'}
ADA = {'a_agriculture': 'agriculture', 'a_water': 'water', 'a_health': 'health', 'a_coastal_zone': 'coastal', 'a_drm': 'disaster-risk', 'a_environment': 'ecosystems', 'a_lulucf': 'land-forests', 'a_urban': 'urban', 'a_energy': 'energy', 'a_transport': 'transport', 'a_education': 'education', 'a_social_development': 'social', 'a_tourism': 'tourism'}
def clean(v):
    v = html.unescape(re.sub(r'<[^>]+>', ' ', str(v)))
    return re.sub(r'\s+', ' ', v).strip()
out = {}
for p in sorted(glob.glob(os.path.join(sys.argv[1], '*.json'))):
    j = os.path.basename(p)[:-5]
    if len(j) != 2: continue
    rows = sorted(json.load(open(p, encoding='utf-8')), key=lambda r: int(r['id']))
    by = {}
    for r in rows: by.setdefault(r['indicator_id'], []).append(clean(r['value']))
    def last(k):
        vals = by.get(k, [])
        good = [v for v in vals if v not in PENDING]
        return good[-1] if good else None
    def pending(k):
        vals = by.get(k, [])
        return bool(vals) and vals[-1] == 'Analysis in progress'
    rec = {
        'submission': last('submission'), 'submitted': last('submission_date'),
        'target': last('ghg_target'), 'targetType': last('ghg_target_type'), 'targetYear': last('time_target_year'),
        'conditionality': last('conditionality'),
        'targetPending': pending('ghg_target'),
        'mitigation': sorted({s for k, s in MIT.items() if last(k)}),
        'adaptation': sorted({s for k, s in ADA.items() if last(k)}),
    }
    out[j] = rec
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for j, r in out.items():
    print(j, r['submission'], r['submitted'], '| pend' if r['targetPending'] else '|', r['targetYear'], '|', (r['target'] or '-')[:110])

# ---- emit TypeScript ----
I2 = "DZ EG LY MR MA TN BJ BF CV CI GM GH GN GW LR ML NE NG SN SL TG BI CM CF TD CG CD GQ GA ST KM DJ ER ET KE MG MU RW SC SO SS SD TZ UG AO BW SZ LS MW MZ NA ZA ZM ZW UK US EU".split()
I3 = "DZA EGY LBY MRT MAR TUN BEN BFA CPV CIV GMB GHA GIN GNB LBR MLI NER NGA SEN SLE TGO BDI CMR CAF TCD COG COD GNQ GAB STP COM DJI ERI ETH KEN MDG MUS RWA SYC SOM SSD SDN TZA UGA AGO BWA SWZ LSO MWI MOZ NAM ZAF ZMB ZWE GBR USA EUU".split()
iso3 = dict(zip(I2, I3))
def isodate(v):
    if not v: return None
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})$', v)
    return f'{m[3]}-{int(m[1]):02d}-{int(m[2]):02d}' if m else None
def q(v):
    return 'null' if v is None else json.dumps(v, ensure_ascii=False)
lines = ["// Generated from the Climate Watch (WRI) NDC content API on 19 October 2026; do not edit by hand.",
         "// Each country's latest NDC: submission, headline target and the sectors it names. Verify against the NDC document.",
         "import type { NdcSector } from './ndc.ts'", "",
         "export const NDC_CHECKED = '2026-10-19'", "",
         "type Raw = { iso3: string; submission: string | null; submitted: string | null; target: string | null; targetYear: string | null; conditionality: string | null; targetPending: boolean; mitigation: NdcSector[]; adaptation: NdcSector[] }",
         "export const NDC_DATA: Record<string, Raw> = {"]
for j in I2:
    r = out.get(j)
    if not r: continue
    lines.append(f"  {j}: {{ iso3: '{iso3[j]}', submission: {q(r['submission'])}, submitted: {q(isodate(r['submitted']))}, target: {q(r['target'])}, targetYear: {q(r['targetYear'])}, conditionality: {q(r['conditionality'])}, targetPending: {str(r['targetPending']).lower()}, mitigation: {json.dumps(r['mitigation'])}, adaptation: {json.dumps(r['adaptation'])} }},")
lines.append("}")
open(sys.argv[3], 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
