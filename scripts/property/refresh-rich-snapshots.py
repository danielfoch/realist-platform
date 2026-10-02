"""Refresh compact, whitelisted public snapshots; no production credentials needed.

Every feed is fully validated before atomically replacing its last good file.
Only civic/building evidence is retained, never owner/applicant/contact fields.
"""
import hashlib
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'lib/property/data'
ROOT.mkdir(exist_ok=True)
CKAN = 'https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/'
ALLOWED = {'ckan0.cf.opendata.inter.prod-toronto.ca', 'maps1.brampton.ca', 'services3.arcgis.com', 'www.arcgis.com'}

def get(base, params=None):
    url = base + ('?' + urllib.parse.urlencode(params) if params else '')
    assert urllib.parse.urlparse(url).hostname in ALLOWED
    request = urllib.request.Request(url, headers={'User-Agent': 'Realist Homies public-property snapshots (hello@realist.ca)'})
    with urllib.request.urlopen(request, timeout=45) as response:
        payload = response.read(12_000_001)
    if len(payload) > 12_000_000:
        raise ValueError('Unexpected response size')
    data = json.loads(payload)
    if data.get('error') or data.get('success') is False:
        raise ValueError('Source query failed')
    return data

REG_FIELDS = 'RSN,SITE_ADDRESS,YEAR_BUILT,YEAR_REGISTERED,CONFIRMED_STOREYS,NO_OF_STOREYS,CONFIRMED_UNITS,NO_OF_UNITS,HEATING_TYPE,AIR_CONDITIONING_TYPE,NO_OF_ELEVATORS,ELEVATOR_STATUS,PARKING_TYPE,VISITOR_PARKING,BARRIER_FREE_ACCESSIBILTY_ENTR,NO_BARRIER_FREE_ACCESSBLE_UNITS,BALCONIES,LAUNDRY_ROOM,NON_SMOKING_BUILDING,NON-SMOKING_BUILDING,SEPARATE_HYDRO_METER_EACH_UNIT,SEPARATE_GAS_METERS_EACH_UNIT,SEPARATE_WATER_METERS_EA_UNIT,AMENITIES_AVAILABLE,FACILITIES_AVAILABLE,PETS_ALLOWED,PET_RESTRICTIONS'
EVAL_FIELDS = '_id,RSN,SITE ADDRESS,YEAR BUILT,YEAR EVALUATED,EVALUATION COMPLETED ON,CURRENT BUILDING EVAL SCORE,PROACTIVE BUILDING SCORE,CURRENT REACTIVE SCORE,NO OF AREAS EVALUATED,COMMON AREA PESTS,BUILDING CLEANLINESS,ELEVATOR MAINTENANCE,EXTERIOR GROUNDS,BUILDING EXTERIOR,STATE OF GOOD REPAIR PLAN'

def publish(key, records, updated, source_query, fields):
    if not records:
        raise ValueError('Unexpected empty source; last good snapshot preserved')
    value = {'dataset': key, 'retrievedAt': datetime.now(timezone.utc).isoformat(),
             'sourceUpdatedAt': updated, 'rowCount': len(records),
             'sourceQuery': source_query, 'selectedFields': fields, 'records': records}
    raw = json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()
    destination = ROOT / (key + '.json')
    temporary = destination.with_suffix('.partial')
    temporary.write_bytes(raw)
    os.replace(temporary, destination)
    print(json.dumps({'dataset': key, 'records': len(records), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}), flush=True)

def ckan_snapshot(key, slug, rid, fields):
    before = get(CKAN + 'package_show', {'id': slug})['result']
    if before.get('license_id') != 'open-government-licence-toronto':
        raise ValueError('Toronto licence changed; review before refreshing')
    resources = before['resources']
    resource = next(x for x in resources if x['id'] == rid and x.get('datastore_active'))
    updated = resource.get('last_modified')
    if not updated:
        updated = next((x.get('last_modified') for x in resources if x['name'] == resource['name'] + '.csv'), None)
    args = {'resource_id': rid, 'limit': 500, 'fields': fields, 'sort': '_id asc'}
    records = []
    total = None
    while total is None or len(records) < total:
        result = get(CKAN + 'datastore_search', {**args, 'offset': len(records)})['result']
        if result.get('total_was_estimated'):
            raise ValueError('Estimated total cannot establish snapshot completeness')
        if total is None:
            total = result['total']
            if not 0 < total <= 15_000:
                raise ValueError('Unexpected source count')
        if result['total'] != total or not result['records']:
            raise ValueError('Source changed or pagination ended early')
        records.extend({k: r.get(k) for k in fields.split(',')} for r in result['records'])
    after = get(CKAN + 'package_show', {'id': slug})['result']
    end = get(CKAN + 'datastore_search', {'resource_id': rid, 'limit': 0})['result']['total']
    if len(records) != total or end != total or before['metadata_modified'] != after['metadata_modified']:
        raise ValueError('Source changed during refresh; last good snapshot preserved')
    if len({str(r['RSN']) for r in records}) != total and key == 'toronto-rental-buildings':
        raise ValueError('Competing building records require review')
    publish(key, records, updated, CKAN + 'datastore_search?resource_id=' + rid, fields.split(','))

def arcgis_snapshot(key, service, fields):
    item_id = {'brampton-additional-units': '7d9df6528d474b43b6771cb7feefc35e', 'brampton-heritage': '2511924166364ccab6228b804f0e134d'}[key]
    item = get('https://www.arcgis.com/sharing/rest/content/items/' + item_id, {'f': 'json'})
    if item.get('licenseInfo') != 'CC BY' or item.get('access') != 'public' or item.get('url') != service:
        raise ValueError('Brampton item rights or source changed; review before refreshing')
    metadata = get(service, {'f': 'json'})
    aliases = {x['name']: x['alias'] for x in metadata['fields']}
    if not set(fields.split(',')).issubset(aliases):
        raise ValueError('Source fields changed; last good snapshot preserved')
    if key == 'brampton-additional-units' and aliases.get('FOURTH_REG') != 'Garden Suite Registered Date':
        raise ValueError('Registration schema changed; garden-suite semantics need review')
    def ids():
        return sorted(get(service + '/query', {'f': 'json', 'where': '1=1', 'returnIdsOnly': 'true'})['objectIds'])
    object_ids = ids()
    if not 0 < len(object_ids) <= 50_000:
        raise ValueError('Unexpected source count')
    records = []
    page_size = 100 if 'services3.arcgis.com' in service else 500
    for offset in range(0, len(object_ids), page_size):
        requested = object_ids[offset:offset + page_size]
        response = get(service + '/query', {'f': 'json', 'objectIds': ','.join(map(str, requested)),
                       'outFields': fields, 'returnGeometry': 'false'})
        batch = [x['attributes'] for x in response['features']]
        if response.get('exceededTransferLimit') or sorted(x['OBJECTID'] for x in batch) != requested:
            raise ValueError('Incomplete ArcGIS page')
        records.extend({k: r.get(k) for k in fields.split(',')} for r in batch)
    after = get(service, {'f': 'json'})
    if ids() != object_ids or metadata.get('editingInfo') != after.get('editingInfo'):
        raise ValueError('Source changed during refresh; last good snapshot preserved')
    timestamp = (metadata.get('editingInfo') or {}).get('dataLastEditDate')
    updated = datetime.fromtimestamp(timestamp / 1000, timezone.utc).isoformat() if timestamp else None
    publish(key, records, updated, service, fields.split(','))

if __name__ == '__main__':
    ckan_snapshot('toronto-rental-buildings', 'apartment-building-registration', '3ad76a8c-0518-4df2-b94e-8c747d62f8c1', REG_FIELDS)
    ckan_snapshot('toronto-building-evaluations', 'apartment-building-evaluation', '244f7a02-da5c-425b-b55f-fbdd133dd732', EVAL_FIELDS)
    arcgis_snapshot('brampton-additional-units', 'https://maps1.brampton.ca/arcgis/rest/services/Two_Unit_Dwellings/Planning_Registered_Additional_Residential_Units/MapServer/0', 'OBJECTID,FULL_ADDRESS,SECOND_REG,THIRD_REG,FOURTH_REG,WARD')
    arcgis_snapshot('brampton-heritage', 'https://services3.arcgis.com/rl7ACuZkiFsmDA2g/arcgis/rest/services/Planning_Local_Government/FeatureServer/13', 'OBJECTID,ADDRESS,PROPERTY_NAME,HERITAGE_STATUS')
