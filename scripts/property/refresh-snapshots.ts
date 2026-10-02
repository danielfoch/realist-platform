import { writeFile, rename } from 'node:fs/promises';
import { fetchSnapshot } from '../../lib/property/refresh';
import { DATASETS, validateSnapshot } from '../../lib/property/snapshots';
async function main() {
  for (const key of DATASETS.filter(k => !process.argv[2] || process.argv[2] === k)) {
    const value = validateSnapshot(await fetchSnapshot(key), key);
    const path = `lib/property/data/${key}.json`;
    await writeFile(path + '.partial', JSON.stringify(value)); await rename(path + '.partial', path);
    console.log(JSON.stringify({ dataset: key, records: value.rowCount, retrievedAt: value.retrievedAt }));
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
