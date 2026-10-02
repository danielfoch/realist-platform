"""Deterministic stratified pilot of 100 unique civic properties from official source records.
Source membership is the ground truth for the selected layer, not proof of ownership/title.
"""
import json,re
from pathlib import Path
root=Path('lib/property/data')
output=Path('/Users/danielfoch/Documents/Homies/outputs/property-four-expansions-2026-10-02')
seen=set(); rows=[]
strata=[('toronto-heritage',25,'Toronto','ADDRESS','heritage','OBJECTID'),('toronto-rental-buildings',25,'Toronto','SITE_ADDRESS','rentalBuilding','RSN'),('brampton-additional-units',25,'Brampton','FULL_ADDRESS','additionalUnits','OBJECTID'),('brampton-heritage',25,'Brampton','ADDRESS','heritage','OBJECTID')]
for dataset,count,city,field,layer,id_field in strata:
 s=json.loads((root/(dataset+'.json')).read_text()); pool=s['records']; chosen=0
 # Spread selection over the complete release rather than taking only the first rows.
 order=sorted(range(len(pool)),key=lambda i: (i*7919)%len(pool))
 for i in order:
  r=pool[i]; address=' '.join(str(r.get(field) or '').split()).strip()
  if not re.match(r'^\d+[A-Za-z]?\s+[A-Za-z]',address) or re.search(r'\b(unit|suite|apt|apartment)\b|#|^\d+\s*-\s*\d+',address,re.I):continue
  key=(city,address.lower())
  if key in seen:continue
  seen.add(key);rows.append({'address':f'{address}, {city}, ON','expectedLayer':layer,'expectedRecordId':str(r[id_field]),'sourceDataset':dataset,'sourceRetrievedAt':s['retrievedAt'],'sourceUpdatedAt':s['sourceUpdatedAt']})
  chosen+=1
  if chosen==count:break
 assert chosen==count
assert len(rows)==100
output.mkdir(exist_ok=True,parents=True)
(output/'pilot-manifest.json').write_text(json.dumps({'properties':rows,'method':'100 unique civic addresses, 25 per source stratum. Expected record IDs are copied from official source snapshots before API calls. Purposeful known-positive sample; not a representative Ontario coverage estimate.'},indent=2))
print({'uniqueProperties':len(rows),'strata':4})
