# Ridgeline mock API

An in-memory implementation of the Ridgeline COP API.

## Running

```bash
cd mock-api
python3 server.py                 # http://127.0.0.1:8080/v1
python3 server.py --port 9000     # or PORT=9000 python3 server.py
python3 server.py --host 0.0.0.0  # or HOST=0.0.0.0 python3 server.py
```

Requires Python 3.10 or newer. There is a devcontainer at the repository root
(`.devcontainer/`) that pins 3.12.7 and also sets up the frontend — open the
repository root in the container, and `python server.py` binds `0.0.0.0:8080`
with the port forwarded, because `HOST` is set in the container environment.

Every response carries permissive CORS headers.

## Examples

```bash
BASE=http://127.0.0.1:8080/v1

curl -s -X POST $BASE/points-of-interest \
  -H 'Content-Type: application/json' \
  -d '{
        "name": "Saddle Creek Overlook",
        "poiCategory": "Observation",
        "geometry": { "type": "Point", "coordinates": [-106.4453, 39.6403, 3421.5] }
      }'

curl -s "$BASE/areas-of-interest?bbox=-106.55,39.55,-106.35,39.75&pageSize=10"

curl -s "$BASE/trail-routes?difficulty=Moderate&from=2026-03-14T00:00:00Z&to=2026-03-15T00:00:00Z"
```
