"""Recover DA geometry with disclosed 10-metre simplification from the official cartographic archive.

Requires pyshp and pyproj (temporary installation is supported with
--python-deps on the importer). No archive path is used as a destination.
"""
import io
import json
import sys
import zipfile

sys.path.insert(0, sys.argv[4])
import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import shape, mapping

archive, known_file, _ = sys.argv[1:4]
known = set(json.load(open(known_file)))
with zipfile.ZipFile(archive) as source:
    prefix = "lda_000b21a_e"
    transformer = Transformer.from_crs(
        CRS.from_wkt(source.read(prefix + ".prj").decode()), "EPSG:4326", always_xy=True
    )
    reader = shapefile.Reader(
        shp=io.BytesIO(source.read(prefix + ".shp")),
        shx=io.BytesIO(source.read(prefix + ".shx")),
        dbf=io.BytesIO(source.read(prefix + ".dbf")),
    )

    def project(coords):
        if isinstance(coords[0], (float, int)):
            x, y = transformer.transform(coords[0], coords[1])
            return [x, y]
        return [project(c) for c in coords]

    for index, record in enumerate(reader.iterRecords()):
        properties = record.as_dict()
        if str(properties["DAUID"]) in known:
            continue
        # The northern polygons can exceed 128 MB as WGS84 JSON. Simplify in
        # the source metre-based CRS, preserve topology and disclose resolution.
        geom = dict(mapping(shape(reader.shape(index).__geo_interface__).simplify(10, preserve_topology=True)))
        geom["coordinates"] = project(geom["coordinates"])
        print(json.dumps({"geometry": geom, "properties": properties, "simplificationM": 10}, separators=(",", ":")))
