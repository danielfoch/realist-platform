"""Build a candidate factual header snapshot from previously audited original City PDFs."""
import argparse
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
import pdfplumber

cli = argparse.ArgumentParser()
cli.add_argument('audit', type=Path)
args = cli.parse_args()
offers = json.loads((args.audit / 'decision-offers.json').read_text())
files = json.loads((args.audit / 'decision-download-manifest.json').read_text())
assert len(files) == 16 and len({f['url'] for f in files}) == 16
assert len(offers) == 17 and {o['url'] for o in offers} == {f['url'] for f in files}
records = []
months = 'January February March April May June July August September October November December'.split()
for f in files:
    u = urlparse(f['url'])
    assert u.scheme == 'https' and u.hostname == 'media-001-ca.cdn.govstack.com'
    assert re.fullmatch(r'/orilliarecreation-004-ca/media/[a-z0-9]+/[a-z0-9-]+\.pdf', u.path)
    assert not any([u.query, u.fragment, u.username, u.password])
    body = Path(f['file']).read_bytes()
    assert len(body) == f['bytes'] and hashlib.sha256(body).hexdigest() == f['sha256']
    with pdfplumber.open(f['file']) as pdf:
        pages = [p.extract_text() or '' for p in pdf.pages]
    first = pages[0]
    assert first.startswith('CORPORATION OF THE CITY OF ORILLIA\nCOMMITTEE OF ADJUSTMENT\nDECISION\n')
    def field(pattern):
        matches = re.findall(pattern, first, re.M)
        assert len(matches) == 1, (f['url'], pattern)
        return matches[0]
    file_number = field(r'^APPLICATION NO\. ([AB]\d{2}-\d{2})$')
    address = field(r'^ADDRESS (.+)$')
    raw_date = field(r'^DATE OF DECISION (.+)$')
    month, day, year = field(r'^DATE OF DECISION ([A-Za-z]+) (\d{1,2}), (\d{4})$')
    date = datetime(int(year), months.index(month) + 1, int(day)).date().isoformat()
    checks = re.findall(r'^([☐☒]) (Approved|Approved with conditions\*|Denied|Deferred)$', first, re.M)
    assert len(checks) in [3, 4] and len({c[1] for c in checks}) == len(checks)
    outcomes = [label.replace('*', '') for glyph, label in checks if glyph == '☒']
    assert len(outcomes) == 1
    page_refs = [{k: o[k] for k in ['fileNumber', 'caseLabel', 'context']} for o in offers if o['url'] == f['url']]
    records.append({
        'documentFileNumber': file_number, 'documentPublishedAddress': address,
        'publishedDecisionDate': raw_date, 'publishedDecisionCalendarDate': date,
        'publishedOutcome': outcomes[0], 'sourcePage': 1, 'sourcePDFPages': len(pages),
        'sourceUrl': f['url'], 'sourceFileSha256': f['sha256'], 'sourceFileBytes': f['bytes'],
        'pageReferences': page_refs,
    })
assert len({r['documentFileNumber'] for r in records}) == 16
snapshot = {'dataset': 'orillia-selected-decision-headers', 'parserVersion': 'orillia-decision-header-v1',
            'retrievedAt': max(f['retrievedAt'] for f in files), 'sourceUpdatedAt': None,
            'records': sorted(records, key=lambda r: r['documentFileNumber'])}
path = args.audit / 'candidate-decision-snapshot.json'
path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
print('Candidate', path, hashlib.sha256(path.read_bytes()).hexdigest())
for r in snapshot['records']:
    print(r['documentFileNumber'], r['documentPublishedAddress'], r['publishedDecisionCalendarDate'], r['publishedOutcome'],
          'PAGE-LABEL CONFLICT' if any(o['fileNumber'] != r['documentFileNumber'] for o in r['pageReferences']) else '')
