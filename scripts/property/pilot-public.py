"""100-property hosted pilot. Rate-limited and read-only; preserves failures and full public evidence.
Usage: python3 scripts/property/pilot-public.py [public-base-url]
"""
import json,sys,time,urllib.parse,urllib.request,urllib.error,statistics
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
BASE=sys.argv[1] if len(sys.argv)>1 else 'https://realist-lean.vercel.app'
OUT=Path('/Users/danielfoch/Documents/Homies/outputs/property-four-expansions-2026-10-02')
manifest=json.loads((OUT/'pilot-manifest.json').read_text());lock=Lock();last_start=0
results=[]
def call(p):
 global last_start
 with lock:
  wait=max(0,last_start+2.6-time.monotonic())
  if wait:time.sleep(wait)
  last_start=time.monotonic()
 start=time.monotonic(); url=BASE+'/api/property?'+urllib.parse.urlencode({'address':p['address']})
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Homies property-forensics 100-property pilot'}),timeout=45) as r:code=r.status;d=json.load(r)
 except urllib.error.HTTPError as e:
  code=e.code
  try:d=json.load(e)
  except Exception:d={'error':'non_json_http_error'}
 except Exception as e:code=0;d={'error':type(e).__name__}
 elapsed=time.monotonic()-start
 layer=d.get('layers',{}).get(p['expectedLayer'],{})
 v=layer.get('data') or {};ids=[str(x.get('recordId')) for x in v.get('records',[])]
 if v.get('buildingId') is not None:ids.append(str(v['buildingId']))
 identity_ok=p['expectedRecordId'] in ids and layer.get('status')=='available'
 return {'property':p,'httpStatus':code,'seconds':round(elapsed,3),'groundTruthMatch':identity_ok,'returnedLayerStatus':layer.get('status'),'available':d.get('available',[]),'coordinateAccuracy':((d.get('layers',{}).get('location',{}).get('data') or {}).get('accuracy')),'result':d}
start=time.monotonic()
with ThreadPoolExecutor(max_workers=3) as executor:
 for i,r in enumerate(executor.map(call,manifest['properties']),1):
  results.append(r)
  with (OUT/'pilot-results.jsonl').open('a') as f:f.write(json.dumps(r,ensure_ascii=False)+'\n')
  if i%10==0: print(json.dumps({'completed':i,'matched':sum(x['groundTruthMatch'] for x in results),'httpFailures':sum(x['httpStatus']!=200 for x in results)}),flush=True)
latencies=sorted(r['seconds'] for r in results if r['httpStatus']==200)
coverage={}
for r in results:
 for layer in r['available']:coverage[layer]=coverage.get(layer,0)+1
summary={'properties':len(results),'uniqueProperties':len({r['property']['address'].lower() for r in results}),'sourceRecordMatches':sum(r['groundTruthMatch'] for r in results),'http200':sum(r['httpStatus']==200 for r in results),'secondsTotal':round(time.monotonic()-start,2),'medianSeconds':statistics.median(latencies) if latencies else None,'p95Seconds':latencies[min(len(latencies)-1,int(len(latencies)*.95))] if latencies else None,'availableLayerCounts':coverage,'samplingMethod':manifest['method'],'humanMinutesSaved':None,'humanTimeSavedNote':'No realtor timed a paired manual workflow. API latency and source consolidation are measured; human time savings are not claimed.','failures':[{'property':r['property'],'httpStatus':r['httpStatus'],'layerStatus':r['returnedLayerStatus'],'error':r['result'].get('error')} for r in results if not r['groundTruthMatch']]}
(OUT/'pilot-summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary),flush=True)
