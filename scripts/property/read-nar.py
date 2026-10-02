"""Stream one official NAR archive member as JSON; never extract archive paths."""
import csv
import io
import json
import sys
import zipfile

archive, member = sys.argv[1:3]
if not member.startswith(("Locations/Location_", "Addresses/Address_")) or not member.endswith(".csv"):
    raise ValueError("Expected an official NAR CSV member")
with zipfile.ZipFile(archive) as source:
    with source.open(member) as stream:
        for row in csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig", newline="")):
            print(json.dumps(row, ensure_ascii=False, separators=(",", ":")))
