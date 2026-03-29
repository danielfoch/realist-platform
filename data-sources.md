# Realist.ca Data Sources for Map Layers

This document outlines data sources for toggleable map layers.

---

## 1. CRIME DATA

### Statistics Canada
- **URL:** https://www150.statcan.gc.ca/t1/tbl1/en/t.36-30-0001-01
- **Data:** Crime severity index, crime rate per 100,000
- **Geography:** Census metropolitan areas (CMA), provinces
- **Frequency:** Annual

### City Open Data Portals
| City | Portal URL | Crime Data |
|------|------------|------------|
| Toronto | https://open.toronto.ca/ | Neighbourhood crime counts |
| Vancouver | https://data.vancouver.ca/ | Crime by type, location |
| Calgary | https://data.calgary.ca/ | Crime statistics |
| Montreal | https://donnees.montreal.ca/ | Crime incidents |
| Ottawa | https://data.ottawa.ca/ | Crime mapping |

### Implementation
- Download CSVs from portals
- Geocode to lat/long
- Store in PostgreSQL with PostGIS
- Render as heatmap layer

---

## 2. ETHNIC DIVERSITY

### Statistics Canada Census
- **Dataset:** "Ethnocultural diversity" (98-402-X2016001)
- **Variables:** Immigration, visible minority, ethnic origin, language
- **Geography:** Census tracts, dissemination areas
- **Format:** CSV download from https://statcan.gc.ca/eng/98-402-X2016001

### Specific Tables
- 98-400-X2016001: Immigration and ethnocultural diversity
- 98-400-X2016006: Visible minority
- 98-400-X2016008: Ethnic origin

### Implementation
- Download by census geography
- Join to dissemination areas (DA)
- Calculate diversity index

---

## 3. HOMEOWNERSHIP RATE

### Statistics Canada
- **Dataset:** "Housing" (98-402-X2016001)
- **Table:** 98-400-X2016040 - Structural type of dwelling by tenure
- **Variables:** Owner-occupied, rented, band housing
- **Geography:** Census tracts, DA

### CMHC
- **URL:** https://www.cmhc-schl.gc.ca/
- **Data:** Social and affordable housing, homeownership programs
- **Format:** Excel downloads

---

## 4. HOUSEHOLD INCOME

### Statistics Canada
- **Dataset:** "Income" (98-402-X2016001)
- **Table:** 98-400-X2016110 - Income in 2015
- **Variables:** Median household income, average income
- **Geography:** Census tracts, DA

### Implementation
- Download CSV by census tract
- Join to geographic boundaries
- Color-code by income brackets

---

## 5. TRANSIT ROUTES / BUS STATIONS

### OpenStreetMap
- **API:** https://overpass-api.de/api/interpreter
- **Query:** Public transit stops, routes
- **Data:** GTFS feeds from transit agencies

### Canadian Transit Data
| City | GTFS URL |
|------|----------|
| Toronto (TTC) | https://open.toronto.ca/dataset/ttc-gtfs-schedule/ |
| Vancouver (TransLink) | https://transitfeeds.com/ |
| Calgary (CTrain) | https://data.calgary.ca/ |
| Montreal (STM) | https://stmontreal.ca/gtfs |
| Ottawa (OC Transpo) | https://data.ottawa.ca/ |

### Implementation
- Fetch GTFS or OSM data
- Store stops and routes in database
- Render as overlay layer

---

## 6. VACANCY RATES

### CMHC Rental Market Survey
- **URL:** https://www.cmhc-schl.gc.ca/en/housing-markets-data-and-rental-market
- **Data:** Vacancy rates by bedroom type, city
- **Geography:** Census metropolitan areas (CMA)
- **Frequency:** Semi-annual (April, October)

### Statistics Canada
- **Dataset:** "Rental housing, vacant units"
- **Table:** 34-10-0178-01 - Vacancy rates, Canada and regions

### Implementation
- Download from CMHC/StatCan
- Map CMA to geographic areas
- Display as layer on map

---

## DATA ACCESS OPTIONS

### Option 1: Manual Download
- Visit portals above
- Download CSVs/Excel
- Upload to database

### Option 2: API Integration
- Build scrapers/fetchers for each source
- Schedule automated updates
- Cache in database

### Option 3: Third-Party Data Providers
- Beyond20/20 (census data)
- Environics Analytics
- GeoWerk

---

## PRIORITY

1. **High:** Transit (easy via OSM), Income (StatCan)
2. **Medium:** Vacancy (CMHC), Homeownership (StatCan)
3. **Lower:** Crime (various portals), Diversity (StatCan)

---

## NOTES

- Census data updated every 5 years (2021, 2026)
- Some data requires registration
- City open data often more granular than federal
- GTFS is standard for transit (widely available)
