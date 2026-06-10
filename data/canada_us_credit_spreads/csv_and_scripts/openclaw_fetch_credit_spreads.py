"""
OpenClaw / autoresearch fetch script for the Canada-vs-US residential/business credit spread project.

This script fetches the full official time series behind the seed data pack.
It assumes internet access. It writes CSVs into ./credit_spreads_full_data.

Suggested run:
    python openclaw_fetch_credit_spreads.py
"""

from __future__ import annotations

import csv
import io
import json
import zipfile
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import quote


OUT = Path("credit_spreads_full_data")
OUT.mkdir(exist_ok=True)

HEADERS = {"User-Agent": "OpenClaw autoresearch credit-spreads dataset builder/1.0"}


def get_text(url: str) -> str:
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8")


def write_text(name: str, text: str) -> None:
    (OUT / name).write_text(text, encoding="utf-8")


def fetch_fred_csv(series_id: str, name: str | None = None) -> None:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={quote(series_id)}"
    text = get_text(url)
    write_text(name or f"fred_{series_id}.csv", text)


def fetch_boc_valet_group(group_id: str, name: str | None = None, start_date: str | None = None) -> None:
    suffix = f"?start_date={start_date}" if start_date else ""
    url = f"https://www.bankofcanada.ca/valet/observations/group/{group_id}/json{suffix}"
    raw = get_text(url)
    data = json.loads(raw)
    series_names = list(data.get("seriesDetail", {}).keys())
    rows = []
    for obs in data.get("observations", []):
        row = {"date": obs.get("d")}
        for sid in series_names:
            row[sid] = obs.get(sid, {}).get("v")
        rows.append(row)
    out_name = name or f"boc_{group_id}.csv"
    with (OUT / out_name).open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["date"] + series_names)
        writer.writeheader()
        writer.writerows(rows)
    write_text((out_name.replace(".csv", "_metadata.json")), json.dumps(data.get("seriesDetail", {}), indent=2))


def fetch_boc_valet_series(series_ids: list[str], name: str, start_date: str | None = None) -> None:
    joined = ",".join(series_ids)
    suffix = f"?start_date={start_date}" if start_date else ""
    url = f"https://www.bankofcanada.ca/valet/observations/{joined}/json{suffix}"
    raw = get_text(url)
    data = json.loads(raw)
    rows = []
    for obs in data.get("observations", []):
        row = {"date": obs.get("d")}
        for sid in series_ids:
            row[sid] = obs.get(sid, {}).get("v")
        rows.append(row)
    with (OUT / name).open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["date"] + series_ids)
        writer.writeheader()
        writer.writerows(rows)


def fetch_statcan_zip(table_id_no_hyphens: str, name: str) -> None:
    url = f"https://www150.statcan.gc.ca/n1/tbl/csv/{table_id_no_hyphens}-eng.zip"
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=120) as resp:
        payload = resp.read()
    zpath = OUT / f"{name}.zip"
    zpath.write_bytes(payload)
    with zipfile.ZipFile(io.BytesIO(payload)) as zf:
        zf.extractall(OUT / name)


def main() -> None:
    # Canada: posted bank rates and residential/business lending rates
    fetch_boc_valet_group("chartered_bank_interest", "boc_chartered_bank_interest_weekly.csv")
    fetch_boc_valet_group("A4_RATES_MONTHLY", "boc_new_existing_lending_rates_monthly_all.csv", start_date="2013-01-01")
    fetch_boc_valet_group("A4_RATES_MORTGAGES", "boc_new_existing_lending_rates_mortgages.csv", start_date="2013-01-01")
    fetch_boc_valet_group("A4_RATES_EXTENDED", "boc_new_existing_lending_rates_corporate_extended.csv", start_date="2013-01-01")

    # Core Canada series IDs used in the spread model
    fetch_boc_valet_series(
        ["V80691335", "V80691311", "V122667780", "V122667786", "V122667816", "V122667818", "V122667819"],
        "boc_core_spread_series.csv",
        start_date="2013-01-01",
    )

    # United States: mortgage and residential investment shares via FRED
    for sid in ["MORTGAGE30US", "A011RE1Q156NBEA", "A011RE1A156NBEA", "A008RE1Q156NBEA", "A008RE1A156NBEA"]:
        fetch_fred_csv(sid)

    # Statistics Canada tables
    fetch_statcan_zip("33100164", "statcan_business_entry_exit_33100164")
    fetch_statcan_zip("36100706", "statcan_gdp_per_capita_36100706")
    fetch_statcan_zip("14100027", "statcan_class_of_worker_14100027")
    fetch_statcan_zip("34100145", "statcan_cmhc_5y_mortgage_rate_34100145")

    print(f"Wrote files to {OUT.resolve()}")


if __name__ == "__main__":
    main()