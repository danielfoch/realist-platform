# Environment Variables

## Required
- `DATABASE_URL`: PostgreSQL connection string.
- `DDF_USERNAME`: CREA DDF username.
- `DDF_PASSWORD`: CREA DDF password.

## Optional
- `PORT`: API port (default `3000`).
- `LOG_LEVEL`: `debug|info|warn|error` (default `info`).
- `RENT_API_URL`: override rent API base URL for sync script.
- `VITE_MAPBOX_TOKEN`: map token for frontend map component.

## Example
```env
DATABASE_URL=postgres://user:password@localhost:5432/realist_idx
DDF_USERNAME=your_ddf_user
DDF_PASSWORD=your_ddf_password
PORT=3000
LOG_LEVEL=info
RENT_API_URL=https://realist.ca/api/rents
VITE_MAPBOX_TOKEN=pk.your_mapbox_key
```
