import pathlib,json,re,hashlib,datetime,collections,argparse
import pdfplumber
args=argparse.ArgumentParser(description="Parse the reviewed fixed Orillia reports offline. No network calls or automatic publication.")
args.add_argument("audit_dir",type=pathlib.Path,help="Contains download-manifest.json and tmp/pdfs/YYYY-MM.pdf")
args.add_argument("--retrieved-at",required=True,help="Actual source-download timestamp in ISO format")
config=args.parse_args();ROOT=config.audit_dir
assert datetime.datetime.fromisoformat(config.retrieved_at).tzinfo is not None
expected=json.loads((pathlib.Path(__file__).parents[2]/"lib/property/fixtures/orillia/selected-files.json").read_text())
FIELDS={'permits':['Permit#','Roll#','ProjectAddress','PermitClass','ConstructionTyp','PermitType','DevelopmentCha','Status','Fees','ProjectValue','WorkArea','IssuedDate','OBCCategory'],
        'inspections':['Inspection#','Roll#','ProjectAddress','InspectionDate','PermitType','PermitIssuedDate','Permit#']}
KEYS={'permits':['permitNumber',None,'publishedAddress','publishedPermitClass','publishedConstructionType','publishedPermitType',None,'publishedStatus',None,'publishedProjectValue', 'publishedWorkMeasure','publishedIssuedDate','publishedOBCClass'],
      'inspections':['inspectionNumber',None,'publishedAddress','publishedInspectionDate','publishedPermitType','publishedIssuedDate','permitNumber']}
def linechars(page,top): return sorted([c for c in page.chars if abs(c['top']-top)<1.5],key=lambda c:c['x0'])
def compact(cs):return ''.join(c['text']for c in cs if not c['text'].isspace())
def native_runs(page,top):
    # Preserve drawing order: overlong fees/measures can cross the next column.
    # Assign a whole contiguous text run by its first glyph, never its overflow.
    runs=[]
    for c in [c for c in page.chars if abs(c['top']-top)<1.5]:
        if not runs or abs(c['x0']-runs[-1][-1]['x1'])>.8:
            runs.append([c])
        else:runs[-1].append(c)
    return runs
def cols(page,kind,top):
    chars=[c for c in linechars(page,top)if not c['text'].isspace()];s=compact(chars);columns=[]
    for field,key in zip(FIELDS[kind],KEYS[kind]):
        if field=='OBCCategory'and field not in s:continue
        assert field in s,(kind,field,s)
        start=s.index(field);columns.append((chars[start]['x0'],key))
    # OBC Category can be followed by application dates, which are not selected.
    tail=s.find('Application')
    columns.sort();positions=[x for x,_ in columns];keys=[k for _,k in columns]
    positions.append(chars[tail]['x0']if tail>=0 else page.width-20)
    assert all(a<b for a,b in zip(positions,positions[1:]))
    return positions,keys
def clean_date(raw):
    if not raw:return None
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}(?: \d{1,2}:\d{2})?',raw):return raw[:10]
    m=re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{2}|\d{4}) \d{1,2}:\d{2}',raw)
    if m:
        month,day,year=map(int,m.groups())
        return datetime.date(year if year>100 else 2000+year,month,day).isoformat()
    return None
def usable_address(raw,clipped):
    if clipped:return None,'column_edge_or_clipped'
    raw=re.sub(r',\s*Orillia,\s*(?:ON|Ontario),\s*Canada$','',raw,flags=re.I)
    if not re.fullmatch(r'\d+[A-Za-z]? [A-Za-z][A-Za-z0-9 .\'’&-]*',raw):return None,'missing_or_non_civic_address'
    if re.search(r'\b(unit|suite|apt|apartment|app)\b|#|^\d+\s*-\s*\d+',raw,re.I):return None,'unit_or_civic_range'
    if not re.search(r'\b(?:ST|STREET|AVE|AVENUE|RD|ROAD|DR|DRIVE|BLVD|BOULEVARD|CRES|CRESCENT|CRT|CT|COURT|LANE|LN|PL|PLACE|WAY|TRAIL|PKY|PKWY|PARKWAY|LINE|SIDEROAD|HTS|HEIGHTS|COVE)(?:\.?)(?: (?:N|S|E|W|NORTH|SOUTH|EAST|WEST))?$',raw,re.I):return None,'incomplete_or_unsupported_street_suffix'
    return raw,None
all_records={'permits':[],'inspections':[]};file_summaries=[];page_audit=[]
manifest=json.loads((ROOT/'download-manifest.json').read_text())
assert len(manifest)==len(expected) and len({f['period']for f in manifest})==len(expected)
for f in sorted(manifest,key=lambda f:f['period']):
    original=next(x for x in expected if x['period']==f['period'])
    assert all(f[k]==original[k]for k in ['period','url','bytes','sha256'])
    source_bytes=(ROOT/'tmp/pdfs'/f"{f['period']}.pdf").read_bytes()
    assert len(source_bytes)==f['bytes'] and hashlib.sha256(source_bytes).hexdigest()==f['sha256']
    counts=collections.Counter();previous=None;section=None
    with pdfplumber.open(ROOT/'tmp/pdfs'/f"{f['period']}.pdf") as pdf:
        for pi,p in enumerate(pdf.pages):
            words=p.extract_words(x_tolerance=1,y_tolerance=2)
            header=None
            for w in words:
                if w['text']not in ['Permit','Inspection']or w['x0']>80:continue
                s=compact(linechars(p,w['top']))
                kind='inspections'if s.startswith('Inspection#')and'ProjectAddress'in s and'Roll#'in s else'permits'if s.startswith('Permit#')and'ProjectAddress'in s and'Roll#'in s else None
                if kind:header=(kind,w['top']);break
            if header:
                kind,top=header;xs,keys=cols(p,kind,top);previous=(kind,xs,keys,p.width,p.height)
            elif previous and any(re.fullmatch(r'INSP-\d+|PRM-\d{4}-\d{4}',w['text']) and w['x0']<80 for w in words):
                kind,xs,keys,width,height=previous;assert abs(p.width-width)<.1 and abs(p.height-height)<.1;top=0
            else:continue
            anchors=[w for w in words if xs[0]-.5<=w['x0']<xs[1]-1 and re.fullmatch(r'INSP-\d+|PRM-\d{4}-\d{4}',w['text'])]
            assert anchors and all(w['text'].startswith('INSP-'if kind=='inspections'else'PRM-')for w in anchors)
            # A section label describes the publisher's list, not an inspection outcome.
            section_labels=[]
            for w in words:
                if w['text']in ['FINAL','OCCUPANCY'] and w['x0']<xs[1]:
                    assert w['text']+'INSPECTIONS'in compact(linechars(p,w['top']))
                    section_labels.append((w['top'],w['text']+' INSPECTIONS'))
            page_audit.append({'period':f['period'],'page':pi+1,'kind':kind,'rows':len(anchors),'width':p.width,'height':p.height,'columns':xs})
            for ri,w in enumerate(anchors):
                preceding=[label for label in section_labels if label[0]<w['top']]
                if preceding:section=preceding[-1][1]
                cs=linechars(p,w['top']);runs=native_runs(p,w['top']);record={'recordId':f"{f['period']}:{pi+1}:{ri+1}",'reportingPeriod':f['period'],'sourcePage':pi+1,'sourceUrl':f['url'],'sourceFileSha256':f['sha256']};flags=[]
                if kind=='permits':record['publishedOBCClass']=None
                for ci,key in enumerate(keys):
                    if key is None:continue
                    l,r=xs[ci],xs[ci+1]
                    # Some publishers offset body columns fractionally from their header.
                    cell=[c for run in runs if l-.5<=(run[0]['x0']+run[0]['x1'])/2<r-.5 for c in run]
                    raw=''.join(c['text']for c in cell).strip();raw=re.sub(r'\s+',' ',raw)
                    edge=xs[ci+2]if kind=='permits'and key=='publishedPermitType'else r
                    if key in ['publishedAddress','publishedPermitClass','publishedConstructionType','publishedPermitType','publishedWorkMeasure','publishedOBCClass']and cell and ci+1<len(keys) and max(c['x1']for c in cell)>edge-5:flags.append(key)
                    record[key]=raw or None
                assert re.fullmatch(r'PRM-\d{4}-\d{4}',record['permitNumber']or'')
                if kind=='inspections':
                    assert re.fullmatch(r'INSP-\d+',record['inspectionNumber']or'')
                    assert section in ['FINAL INSPECTIONS','OCCUPANCY INSPECTIONS']
                    record['publishedSection']=section
                address,why=usable_address(record['publishedAddress']or'', 'publishedAddress'in flags)
                record.update(address=address,addressExcludedReason=why,possiblyClippedFields=flags,publishedIssuedCalendarDate=clean_date(record['publishedIssuedDate']))
                all_records[kind].append(record);counts[kind]+=1
    file_summaries.append({**f,'rows':dict(counts),'excludedAddressRows':{k:sum(r['address']is None for r in all_records[k]if r['reportingPeriod']==f['period'])for k in all_records}})
    print(f['period'],dict(counts),flush=True)
snapshot={'retrievedAt':config.retrieved_at,'sourceUpdatedAt':None,'reportingPeriods':[f['period']for f in file_summaries],'sourceFiles':file_summaries,**all_records}
assert all(len({r['recordId']for r in records})==len(records)for records in all_records.values())
for kind in ['permits','inspections']:
    for record in snapshot[kind]:
        del record['sourceUrl'];del record['sourceFileSha256']
snapshot.update(dataset='orillia-monthly-reports',parserVersion='orillia-columns-v1')
raw=json.dumps(snapshot,separators=(',',':'),ensure_ascii=False)+'\n'
(ROOT/'candidate-snapshot.json').write_text(raw)
print('SNAPSHOT_SHA256',hashlib.sha256(raw.encode()).hexdigest())
(ROOT/'page-audit.json').write_text(json.dumps(page_audit,indent=2)+'\n')
print('TOTAL',json.dumps({k:{'observations':len(rs),'matchable':sum(bool(r['address'])for r in rs),'exclusions':dict(collections.Counter(r['addressExcludedReason']for r in rs if not r['address']))}for k,rs in all_records.items()}))
