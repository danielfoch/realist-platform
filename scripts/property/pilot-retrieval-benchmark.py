"""Paired automated retrieval benchmark. Measures one public-source evidence task, not human realtor time.
Uses civic-address record matching from the same official heritage export. The direct-source path
includes a fresh export download and DBF scan; a downloaded/cached export would change its timing.
"""
import io,json,time,urllib.request,urllib.parse,zipfile,statistics
from pathlib import Path
OUT=Path('/Users/danielfoch/Documents/Homies/outputs/property-four-expansions-2026-10-02')
BASE='https://realist-lean.vercel.app'
RESOURCE='https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/e41da515-5ad1-4bc3-85ea-18ec9e55cd33/resource/108b1080-d048-439f-a9e8-e8d6cd81bddb/download/heritage_register_address_points_wgs84.zip'
properties=json.loads((OUT/'pilot-manifest.json').read_text())['properties'][:10]
result=[]
for p in properties:
 start=time.monotonic()
 with urllib.request.urlopen(RESOURCE,timeout=45) as r:raw=r.read()
 with zipfile.ZipFile(io.BytesIO(raw)) as archive:
  name=next(k for k in archive.namelist() if k.lower().endswith('.dbf')); data=archive.read(name)
 count=int.from_bytes(data[4:8],'little');header=int.from_bytes(data[8:10],'little');width=int.from_bytes(data[10:12],'little')
 fields=[];offset=1
 for i in range(32,header-1,32):
  f=data[i:i+32];name=f[:11].split(b'\0')[0].decode();size=f[16];fields.append((name,offset,size));offset+=size
 selected={name:(offset,size) for name,offset,size in fields if name in ['OBJECTID','ADDRESS','STATUS','BYLAW_NO','LISTED','DESIGNATED']}
 expected=' '.join(p['address'].split(',')[0].upper().split());match=None
 for i in range(count):
  row=data[header+i*width:header+(i+1)*width]
  if row[0]!=32:continue
  addressOffset,addressSize=selected['ADDRESS'];address=' '.join(row[addressOffset:addressOffset+addressSize].decode().upper().split())
  if address==expected:
   match={name:row[offset:offset+size].decode().strip() for name,(offset,size) in selected.items()};break
 direct=time.monotonic()-start
 start=time.monotonic()
 with urllib.request.urlopen(BASE+'/api/property?'+urllib.parse.urlencode({'address':p['address']}),timeout=45) as r:response=json.load(r)
 api=time.monotonic()-start
 records=(response.get('layers',{}).get('heritage',{}).get('data') or {}).get('records',[])
 matchOK=match is not None and match['OBJECTID']==p['expectedRecordId'] and any(str(r['recordId'])==p['expectedRecordId'] for r in records)
 result.append({'property':p['address'],'directSourceSeconds':round(direct,3),'apiSeconds':round(api,3),'differenceSeconds':round(direct-api,3),'sameHeritageRecord':matchOK})
 time.sleep(2.6)
summary={'pairedProperties':len(result),'allSameRecord':all(r['sameHeritageRecord'] for r in result),'medianDirectSourceSeconds':statistics.median(r['directSourceSeconds'] for r in result),'medianApiSeconds':statistics.median(r['apiSeconds'] for r in result),'medianDifferenceSeconds':statistics.median(r['differenceSeconds'] for r in result),'scope':'Automated fresh heritage-export download and record scan versus one full enrichment call. Not a human workflow estimate; direct download caching, concurrent requests, and a municipal web lookup would change the baseline. Other API layers are additional output, not independently ground-truthed by this benchmark.','pairs':result}
(OUT/'pilot-retrieval-benchmark.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary),flush=True)
