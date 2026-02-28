export interface CmhcRentData {
  bachelor: number;
  oneBed: number;
  twoBed: number;
  threeBed: number;
}

export const CMHC_PROVINCIAL_RENTS: Record<string, CmhcRentData> = {
  "British Columbia": { bachelor: 1198, oneBed: 1459, twoBed: 1807, threeBed: 2168 },
  "Alberta": { bachelor: 950, oneBed: 1150, twoBed: 1410, threeBed: 1580 },
  "Saskatchewan": { bachelor: 700, oneBed: 870, twoBed: 1100, threeBed: 1250 },
  "Manitoba": { bachelor: 720, oneBed: 920, twoBed: 1170, threeBed: 1350 },
  "Ontario": { bachelor: 1150, oneBed: 1400, twoBed: 1700, threeBed: 1950 },
  "Quebec": { bachelor: 720, oneBed: 900, twoBed: 1100, threeBed: 1280 },
  "New Brunswick": { bachelor: 650, oneBed: 820, twoBed: 1000, threeBed: 1120 },
  "Nova Scotia": { bachelor: 850, oneBed: 1050, twoBed: 1350, threeBed: 1520 },
  "Prince Edward Island": { bachelor: 700, oneBed: 880, twoBed: 1100, threeBed: 1250 },
  "Newfoundland and Labrador": { bachelor: 600, oneBed: 780, twoBed: 950, threeBed: 1080 },
  "Northwest Territories": { bachelor: 1100, oneBed: 1350, twoBed: 1700, threeBed: 2000 },
  "Yukon": { bachelor: 1000, oneBed: 1250, twoBed: 1550, threeBed: 1800 },
  "Nunavut": { bachelor: 1200, oneBed: 1500, twoBed: 1900, threeBed: 2200 },
};

export const CMHC_PROVINCIAL_RENTS_ABBREV: Record<string, CmhcRentData> = {
  "BC": { bachelor: 1198, oneBed: 1459, twoBed: 1807, threeBed: 2168 },
  "AB": { bachelor: 950, oneBed: 1150, twoBed: 1410, threeBed: 1580 },
  "SK": { bachelor: 700, oneBed: 870, twoBed: 1100, threeBed: 1250 },
  "MB": { bachelor: 720, oneBed: 920, twoBed: 1170, threeBed: 1350 },
  "ON": { bachelor: 1150, oneBed: 1400, twoBed: 1700, threeBed: 1950 },
  "QC": { bachelor: 720, oneBed: 900, twoBed: 1100, threeBed: 1280 },
  "NB": { bachelor: 650, oneBed: 820, twoBed: 1000, threeBed: 1120 },
  "NS": { bachelor: 850, oneBed: 1050, twoBed: 1350, threeBed: 1520 },
  "PE": { bachelor: 700, oneBed: 880, twoBed: 1100, threeBed: 1250 },
  "NL": { bachelor: 600, oneBed: 780, twoBed: 950, threeBed: 1080 },
  "NT": { bachelor: 1100, oneBed: 1350, twoBed: 1700, threeBed: 2000 },
  "YT": { bachelor: 1000, oneBed: 1250, twoBed: 1550, threeBed: 1800 },
  "NU": { bachelor: 1200, oneBed: 1500, twoBed: 1900, threeBed: 2200 },
};

export const CMHC_CITY_RENTS: Record<string, CmhcRentData> = {
  "Vancouver": { bachelor: 1525, oneBed: 1850, twoBed: 2550, threeBed: 3100 },
  "Burnaby": { bachelor: 1400, oneBed: 1700, twoBed: 2200, threeBed: 2700 },
  "Surrey": { bachelor: 1200, oneBed: 1500, twoBed: 1850, threeBed: 2200 },
  "Richmond": { bachelor: 1350, oneBed: 1650, twoBed: 2100, threeBed: 2500 },
  "Coquitlam": { bachelor: 1300, oneBed: 1600, twoBed: 2000, threeBed: 2400 },
  "Langley": { bachelor: 1200, oneBed: 1450, twoBed: 1800, threeBed: 2100 },
  "New Westminster": { bachelor: 1350, oneBed: 1600, twoBed: 2050, threeBed: 2450 },
  "North Vancouver": { bachelor: 1400, oneBed: 1750, twoBed: 2300, threeBed: 2800 },
  "West Vancouver": { bachelor: 1600, oneBed: 2000, twoBed: 2700, threeBed: 3300 },
  "Victoria": { bachelor: 1100, oneBed: 1400, twoBed: 1800, threeBed: 2100 },
  "Kelowna": { bachelor: 1050, oneBed: 1350, twoBed: 1700, threeBed: 2000 },
  "Nanaimo": { bachelor: 950, oneBed: 1200, twoBed: 1500, threeBed: 1800 },
  "Kamloops": { bachelor: 850, oneBed: 1100, twoBed: 1350, threeBed: 1600 },
  "Abbotsford": { bachelor: 1100, oneBed: 1350, twoBed: 1650, threeBed: 1950 },
  "Chilliwack": { bachelor: 1000, oneBed: 1250, twoBed: 1550, threeBed: 1850 },
  "Prince George": { bachelor: 750, oneBed: 950, twoBed: 1200, threeBed: 1400 },
  "Penticton": { bachelor: 950, oneBed: 1200, twoBed: 1500, threeBed: 1750 },
  "Vernon": { bachelor: 900, oneBed: 1150, twoBed: 1400, threeBed: 1650 },
  "Courtenay": { bachelor: 900, oneBed: 1150, twoBed: 1450, threeBed: 1700 },
  "Duncan": { bachelor: 900, oneBed: 1100, twoBed: 1400, threeBed: 1650 },
  "Langford": { bachelor: 1050, oneBed: 1350, twoBed: 1700, threeBed: 2000 },
  "Sooke": { bachelor: 950, oneBed: 1200, twoBed: 1500, threeBed: 1800 },
  "Colwood": { bachelor: 1050, oneBed: 1300, twoBed: 1650, threeBed: 1950 },
  "Sidney": { bachelor: 1000, oneBed: 1250, twoBed: 1600, threeBed: 1900 },
  "Saanich": { bachelor: 1100, oneBed: 1400, twoBed: 1750, threeBed: 2050 },

  "Calgary": { bachelor: 1100, oneBed: 1350, twoBed: 1650, threeBed: 1900 },
  "Edmonton": { bachelor: 900, oneBed: 1100, twoBed: 1350, threeBed: 1550 },
  "Red Deer": { bachelor: 750, oneBed: 950, twoBed: 1150, threeBed: 1350 },
  "Lethbridge": { bachelor: 750, oneBed: 950, twoBed: 1150, threeBed: 1300 },
  "Medicine Hat": { bachelor: 650, oneBed: 800, twoBed: 1000, threeBed: 1150 },
  "Grande Prairie": { bachelor: 800, oneBed: 1000, twoBed: 1250, threeBed: 1450 },
  "Fort McMurray": { bachelor: 1000, oneBed: 1300, twoBed: 1650, threeBed: 1900 },
  "Airdrie": { bachelor: 1000, oneBed: 1250, twoBed: 1500, threeBed: 1750 },
  "Cochrane": { bachelor: 1050, oneBed: 1300, twoBed: 1550, threeBed: 1800 },
  "Chestermere": { bachelor: 1100, oneBed: 1350, twoBed: 1600, threeBed: 1850 },
  "Okotoks": { bachelor: 1050, oneBed: 1300, twoBed: 1550, threeBed: 1800 },
  "Spruce Grove": { bachelor: 850, oneBed: 1050, twoBed: 1300, threeBed: 1500 },
  "St. Albert": { bachelor: 900, oneBed: 1100, twoBed: 1400, threeBed: 1600 },
  "Sherwood Park": { bachelor: 900, oneBed: 1100, twoBed: 1400, threeBed: 1600 },
  "Leduc": { bachelor: 850, oneBed: 1050, twoBed: 1300, threeBed: 1500 },

  "Regina": { bachelor: 700, oneBed: 850, twoBed: 1100, threeBed: 1250 },
  "Saskatoon": { bachelor: 720, oneBed: 900, twoBed: 1120, threeBed: 1280 },
  "Moose Jaw": { bachelor: 600, oneBed: 750, twoBed: 950, threeBed: 1100 },
  "Prince Albert": { bachelor: 600, oneBed: 750, twoBed: 950, threeBed: 1100 },

  "Winnipeg": { bachelor: 750, oneBed: 950, twoBed: 1200, threeBed: 1400 },
  "Brandon": { bachelor: 600, oneBed: 780, twoBed: 980, threeBed: 1120 },
  "Thompson": { bachelor: 700, oneBed: 900, twoBed: 1100, threeBed: 1300 },

  "Toronto": { bachelor: 1450, oneBed: 1800, twoBed: 2400, threeBed: 2900 },
  "Mississauga": { bachelor: 1350, oneBed: 1650, twoBed: 2150, threeBed: 2600 },
  "Brampton": { bachelor: 1250, oneBed: 1500, twoBed: 1950, threeBed: 2350 },
  "Hamilton": { bachelor: 1050, oneBed: 1300, twoBed: 1650, threeBed: 1950 },
  "Ottawa": { bachelor: 1100, oneBed: 1350, twoBed: 1700, threeBed: 2000 },
  "London": { bachelor: 950, oneBed: 1200, twoBed: 1500, threeBed: 1750 },
  "Kitchener": { bachelor: 1050, oneBed: 1300, twoBed: 1650, threeBed: 1900 },
  "Waterloo": { bachelor: 1050, oneBed: 1300, twoBed: 1650, threeBed: 1900 },
  "Cambridge": { bachelor: 1000, oneBed: 1250, twoBed: 1550, threeBed: 1800 },
  "Guelph": { bachelor: 1050, oneBed: 1300, twoBed: 1600, threeBed: 1850 },
  "Windsor": { bachelor: 800, oneBed: 1050, twoBed: 1300, threeBed: 1500 },
  "Oshawa": { bachelor: 1100, oneBed: 1350, twoBed: 1700, threeBed: 2000 },
  "St. Catharines": { bachelor: 950, oneBed: 1200, twoBed: 1500, threeBed: 1750 },
  "Niagara Falls": { bachelor: 900, oneBed: 1150, twoBed: 1400, threeBed: 1650 },
  "Barrie": { bachelor: 1100, oneBed: 1350, twoBed: 1700, threeBed: 2000 },
  "Kingston": { bachelor: 1000, oneBed: 1250, twoBed: 1550, threeBed: 1800 },
  "Sudbury": { bachelor: 800, oneBed: 1000, twoBed: 1250, threeBed: 1450 },
  "Thunder Bay": { bachelor: 700, oneBed: 900, twoBed: 1100, threeBed: 1300 },
  "Peterborough": { bachelor: 950, oneBed: 1200, twoBed: 1500, threeBed: 1750 },
  "Brantford": { bachelor: 950, oneBed: 1200, twoBed: 1500, threeBed: 1700 },
  "Markham": { bachelor: 1400, oneBed: 1700, twoBed: 2200, threeBed: 2700 },
  "Vaughan": { bachelor: 1400, oneBed: 1700, twoBed: 2200, threeBed: 2700 },
  "Richmond Hill": { bachelor: 1350, oneBed: 1650, twoBed: 2150, threeBed: 2600 },
  "Oakville": { bachelor: 1350, oneBed: 1650, twoBed: 2100, threeBed: 2550 },
  "Burlington": { bachelor: 1200, oneBed: 1450, twoBed: 1850, threeBed: 2200 },
  "Milton": { bachelor: 1200, oneBed: 1450, twoBed: 1850, threeBed: 2200 },
  "Ajax": { bachelor: 1150, oneBed: 1400, twoBed: 1800, threeBed: 2150 },
  "Whitby": { bachelor: 1150, oneBed: 1400, twoBed: 1800, threeBed: 2150 },
  "Pickering": { bachelor: 1200, oneBed: 1450, twoBed: 1850, threeBed: 2200 },
  "Newmarket": { bachelor: 1150, oneBed: 1400, twoBed: 1750, threeBed: 2100 },
  "Aurora": { bachelor: 1200, oneBed: 1450, twoBed: 1850, threeBed: 2200 },
  "Scarborough": { bachelor: 1250, oneBed: 1550, twoBed: 2000, threeBed: 2400 },
  "Etobicoke": { bachelor: 1350, oneBed: 1650, twoBed: 2150, threeBed: 2600 },
  "North York": { bachelor: 1350, oneBed: 1650, twoBed: 2150, threeBed: 2600 },
  "Welland": { bachelor: 850, oneBed: 1050, twoBed: 1350, threeBed: 1550 },
  "Orangeville": { bachelor: 1050, oneBed: 1300, twoBed: 1600, threeBed: 1900 },
  "Orillia": { bachelor: 950, oneBed: 1200, twoBed: 1500, threeBed: 1750 },
  "Belleville": { bachelor: 900, oneBed: 1100, twoBed: 1400, threeBed: 1600 },
  "Sarnia": { bachelor: 750, oneBed: 950, twoBed: 1200, threeBed: 1400 },
  "Chatham-Kent": { bachelor: 700, oneBed: 900, twoBed: 1100, threeBed: 1300 },
  "Cornwall": { bachelor: 750, oneBed: 950, twoBed: 1200, threeBed: 1400 },
  "North Bay": { bachelor: 750, oneBed: 950, twoBed: 1200, threeBed: 1400 },
  "Sault Ste. Marie": { bachelor: 700, oneBed: 900, twoBed: 1100, threeBed: 1300 },
  "Timmins": { bachelor: 700, oneBed: 900, twoBed: 1100, threeBed: 1300 },
  "Woodstock": { bachelor: 950, oneBed: 1200, twoBed: 1450, threeBed: 1700 },
  "Stratford": { bachelor: 950, oneBed: 1200, twoBed: 1450, threeBed: 1700 },
  "Owen Sound": { bachelor: 800, oneBed: 1000, twoBed: 1250, threeBed: 1450 },
  "Cobourg": { bachelor: 1000, oneBed: 1250, twoBed: 1550, threeBed: 1800 },
  "Lindsay": { bachelor: 900, oneBed: 1100, twoBed: 1400, threeBed: 1600 },
  "Collingwood": { bachelor: 1050, oneBed: 1300, twoBed: 1600, threeBed: 1900 },

  "Montreal": { bachelor: 850, oneBed: 1100, twoBed: 1450, threeBed: 1700 },
  "Quebec City": { bachelor: 650, oneBed: 820, twoBed: 1000, threeBed: 1180 },
  "Québec": { bachelor: 650, oneBed: 820, twoBed: 1000, threeBed: 1180 },
  "Laval": { bachelor: 800, oneBed: 1000, twoBed: 1300, threeBed: 1550 },
  "Gatineau": { bachelor: 800, oneBed: 1000, twoBed: 1250, threeBed: 1450 },
  "Longueuil": { bachelor: 780, oneBed: 980, twoBed: 1250, threeBed: 1480 },
  "Sherbrooke": { bachelor: 580, oneBed: 720, twoBed: 900, threeBed: 1050 },
  "Trois-Rivières": { bachelor: 550, oneBed: 700, twoBed: 870, threeBed: 1000 },
  "Saguenay": { bachelor: 500, oneBed: 650, twoBed: 800, threeBed: 950 },
  "Lévis": { bachelor: 650, oneBed: 800, twoBed: 1000, threeBed: 1180 },
  "Terrebonne": { bachelor: 750, oneBed: 950, twoBed: 1200, threeBed: 1400 },
  "Repentigny": { bachelor: 720, oneBed: 900, twoBed: 1150, threeBed: 1350 },
  "Brossard": { bachelor: 850, oneBed: 1050, twoBed: 1350, threeBed: 1600 },
  "Drummondville": { bachelor: 550, oneBed: 700, twoBed: 880, threeBed: 1020 },
  "Saint-Jean-sur-Richelieu": { bachelor: 650, oneBed: 820, twoBed: 1050, threeBed: 1220 },
  "Granby": { bachelor: 580, oneBed: 730, twoBed: 920, threeBed: 1080 },
  "Saint-Hyacinthe": { bachelor: 560, oneBed: 710, twoBed: 900, threeBed: 1050 },
  "Rimouski": { bachelor: 520, oneBed: 680, twoBed: 850, threeBed: 1000 },
  "Victoriaville": { bachelor: 520, oneBed: 660, twoBed: 830, threeBed: 970 },

  "Halifax": { bachelor: 950, oneBed: 1200, twoBed: 1550, threeBed: 1800 },
  "Dartmouth": { bachelor: 900, oneBed: 1100, twoBed: 1400, threeBed: 1650 },
  "Sydney": { bachelor: 650, oneBed: 800, twoBed: 1000, threeBed: 1150 },
  "Truro": { bachelor: 700, oneBed: 850, twoBed: 1050, threeBed: 1200 },
  "New Glasgow": { bachelor: 600, oneBed: 750, twoBed: 950, threeBed: 1100 },

  "Fredericton": { bachelor: 700, oneBed: 880, twoBed: 1100, threeBed: 1250 },
  "Saint John": { bachelor: 650, oneBed: 800, twoBed: 1000, threeBed: 1150 },
  "Moncton": { bachelor: 700, oneBed: 900, twoBed: 1100, threeBed: 1280 },
  "Dieppe": { bachelor: 700, oneBed: 900, twoBed: 1100, threeBed: 1280 },
  "Bathurst": { bachelor: 550, oneBed: 700, twoBed: 870, threeBed: 1000 },
  "Miramichi": { bachelor: 550, oneBed: 700, twoBed: 870, threeBed: 1000 },
  "Edmundston": { bachelor: 550, oneBed: 680, twoBed: 850, threeBed: 980 },

  "Charlottetown": { bachelor: 750, oneBed: 950, twoBed: 1200, threeBed: 1350 },
  "Summerside": { bachelor: 650, oneBed: 800, twoBed: 1000, threeBed: 1150 },

  "St. John's": { bachelor: 650, oneBed: 820, twoBed: 1000, threeBed: 1150 },
  "Mount Pearl": { bachelor: 650, oneBed: 800, twoBed: 980, threeBed: 1120 },
  "Corner Brook": { bachelor: 550, oneBed: 700, twoBed: 850, threeBed: 1000 },
  "Conception Bay South": { bachelor: 650, oneBed: 800, twoBed: 1000, threeBed: 1150 },

  "Yellowknife": { bachelor: 1100, oneBed: 1400, twoBed: 1750, threeBed: 2050 },
  "Whitehorse": { bachelor: 1000, oneBed: 1300, twoBed: 1600, threeBed: 1900 },
  "Iqaluit": { bachelor: 1300, oneBed: 1600, twoBed: 2000, threeBed: 2300 },
};

export const US_STATE_RENTS: Record<string, CmhcRentData> = {
  "Washington": { bachelor: 1200, oneBed: 1400, twoBed: 1700, threeBed: 2000 },
  "WA": { bachelor: 1200, oneBed: 1400, twoBed: 1700, threeBed: 2000 },
  "Oregon": { bachelor: 1100, oneBed: 1300, twoBed: 1550, threeBed: 1850 },
  "OR": { bachelor: 1100, oneBed: 1300, twoBed: 1550, threeBed: 1850 },
  "California": { bachelor: 1500, oneBed: 1800, twoBed: 2300, threeBed: 2800 },
  "New York": { bachelor: 1400, oneBed: 1700, twoBed: 2100, threeBed: 2500 },
  "NY": { bachelor: 1400, oneBed: 1700, twoBed: 2100, threeBed: 2500 },
  "Florida": { bachelor: 1100, oneBed: 1350, twoBed: 1650, threeBed: 1950 },
  "FL": { bachelor: 1100, oneBed: 1350, twoBed: 1650, threeBed: 1950 },
  "Texas": { bachelor: 950, oneBed: 1150, twoBed: 1400, threeBed: 1700 },
  "TX": { bachelor: 950, oneBed: 1150, twoBed: 1400, threeBed: 1700 },
  "Illinois": { bachelor: 1000, oneBed: 1200, twoBed: 1500, threeBed: 1800 },
  "IL": { bachelor: 1000, oneBed: 1200, twoBed: 1500, threeBed: 1800 },
  "Pennsylvania": { bachelor: 900, oneBed: 1100, twoBed: 1350, threeBed: 1600 },
  "PA": { bachelor: 900, oneBed: 1100, twoBed: 1350, threeBed: 1600 },
  "Ohio": { bachelor: 700, oneBed: 850, twoBed: 1050, threeBed: 1250 },
  "OH": { bachelor: 700, oneBed: 850, twoBed: 1050, threeBed: 1250 },
  "Michigan": { bachelor: 750, oneBed: 900, twoBed: 1100, threeBed: 1300 },
  "MI": { bachelor: 750, oneBed: 900, twoBed: 1100, threeBed: 1300 },
  "Georgia": { bachelor: 1000, oneBed: 1200, twoBed: 1450, threeBed: 1750 },
  "GA": { bachelor: 1000, oneBed: 1200, twoBed: 1450, threeBed: 1750 },
  "North Carolina": { bachelor: 900, oneBed: 1100, twoBed: 1350, threeBed: 1600 },
  "NC": { bachelor: 900, oneBed: 1100, twoBed: 1350, threeBed: 1600 },
  "Arizona": { bachelor: 950, oneBed: 1150, twoBed: 1400, threeBed: 1700 },
  "AZ": { bachelor: 950, oneBed: 1150, twoBed: 1400, threeBed: 1700 },
  "Colorado": { bachelor: 1100, oneBed: 1350, twoBed: 1650, threeBed: 2000 },
  "CO": { bachelor: 1100, oneBed: 1350, twoBed: 1650, threeBed: 2000 },
  "Massachusetts": { bachelor: 1400, oneBed: 1700, twoBed: 2100, threeBed: 2500 },
  "MA": { bachelor: 1400, oneBed: 1700, twoBed: 2100, threeBed: 2500 },
  "Tennessee": { bachelor: 850, oneBed: 1050, twoBed: 1300, threeBed: 1550 },
  "TN": { bachelor: 850, oneBed: 1050, twoBed: 1300, threeBed: 1550 },
  "Virginia": { bachelor: 1050, oneBed: 1250, twoBed: 1550, threeBed: 1850 },
  "VA": { bachelor: 1050, oneBed: 1250, twoBed: 1550, threeBed: 1850 },
  "New Jersey": { bachelor: 1200, oneBed: 1450, twoBed: 1800, threeBed: 2150 },
  "NJ": { bachelor: 1200, oneBed: 1450, twoBed: 1800, threeBed: 2150 },
  "Maryland": { bachelor: 1050, oneBed: 1300, twoBed: 1600, threeBed: 1900 },
  "MD": { bachelor: 1050, oneBed: 1300, twoBed: 1600, threeBed: 1900 },
  "Minnesota": { bachelor: 900, oneBed: 1100, twoBed: 1350, threeBed: 1600 },
  "MN": { bachelor: 900, oneBed: 1100, twoBed: 1350, threeBed: 1600 },
  "Indiana": { bachelor: 700, oneBed: 850, twoBed: 1050, threeBed: 1250 },
  "IN": { bachelor: 700, oneBed: 850, twoBed: 1050, threeBed: 1250 },
  "Wisconsin": { bachelor: 750, oneBed: 900, twoBed: 1100, threeBed: 1350 },
  "WI": { bachelor: 750, oneBed: 900, twoBed: 1100, threeBed: 1350 },
  "Missouri": { bachelor: 700, oneBed: 850, twoBed: 1050, threeBed: 1300 },
  "MO": { bachelor: 700, oneBed: 850, twoBed: 1050, threeBed: 1300 },
  "Connecticut": { bachelor: 1100, oneBed: 1350, twoBed: 1650, threeBed: 2000 },
  "CT": { bachelor: 1100, oneBed: 1350, twoBed: 1650, threeBed: 2000 },
  "Nevada": { bachelor: 950, oneBed: 1150, twoBed: 1400, threeBed: 1700 },
  "NV": { bachelor: 950, oneBed: 1150, twoBed: 1400, threeBed: 1700 },
  "Utah": { bachelor: 900, oneBed: 1100, twoBed: 1350, threeBed: 1650 },
  "UT": { bachelor: 900, oneBed: 1100, twoBed: 1350, threeBed: 1650 },
  "Hawaii": { bachelor: 1400, oneBed: 1700, twoBed: 2100, threeBed: 2500 },
  "HI": { bachelor: 1400, oneBed: 1700, twoBed: 2100, threeBed: 2500 },
};

export const US_CITY_RENTS: Record<string, CmhcRentData> = {
  "Seattle": { bachelor: 1500, oneBed: 1800, twoBed: 2300, threeBed: 2800 },
  "Tacoma": { bachelor: 1050, oneBed: 1300, twoBed: 1600, threeBed: 1900 },
  "Gig Harbor": { bachelor: 1200, oneBed: 1450, twoBed: 1750, threeBed: 2100 },
  "Fox Island": { bachelor: 1300, oneBed: 1550, twoBed: 1900, threeBed: 2250 },
  "Portland": { bachelor: 1150, oneBed: 1400, twoBed: 1700, threeBed: 2000 },
  "San Francisco": { bachelor: 2000, oneBed: 2500, twoBed: 3200, threeBed: 3800 },
  "Los Angeles": { bachelor: 1500, oneBed: 1850, twoBed: 2400, threeBed: 2900 },
  "San Diego": { bachelor: 1400, oneBed: 1750, twoBed: 2250, threeBed: 2700 },
  "New York City": { bachelor: 2200, oneBed: 2800, twoBed: 3500, threeBed: 4200 },
  "Miami": { bachelor: 1400, oneBed: 1750, twoBed: 2200, threeBed: 2650 },
  "Chicago": { bachelor: 1150, oneBed: 1400, twoBed: 1750, threeBed: 2100 },
  "Dallas": { bachelor: 1050, oneBed: 1250, twoBed: 1550, threeBed: 1850 },
  "Houston": { bachelor: 950, oneBed: 1150, twoBed: 1400, threeBed: 1700 },
  "Austin": { bachelor: 1150, oneBed: 1400, twoBed: 1700, threeBed: 2050 },
  "Denver": { bachelor: 1200, oneBed: 1450, twoBed: 1800, threeBed: 2150 },
  "Boston": { bachelor: 1700, oneBed: 2100, twoBed: 2700, threeBed: 3200 },
  "Atlanta": { bachelor: 1100, oneBed: 1350, twoBed: 1650, threeBed: 2000 },
  "Phoenix": { bachelor: 1000, oneBed: 1200, twoBed: 1500, threeBed: 1800 },
  "Las Vegas": { bachelor: 950, oneBed: 1150, twoBed: 1400, threeBed: 1700 },
  "Nashville": { bachelor: 1100, oneBed: 1350, twoBed: 1700, threeBed: 2050 },
  "Charlotte": { bachelor: 1000, oneBed: 1200, twoBed: 1500, threeBed: 1800 },
  "Raleigh": { bachelor: 1000, oneBed: 1200, twoBed: 1500, threeBed: 1800 },
  "Minneapolis": { bachelor: 1000, oneBed: 1200, twoBed: 1500, threeBed: 1800 },
  "Salt Lake City": { bachelor: 950, oneBed: 1150, twoBed: 1400, threeBed: 1700 },
};

const CA_ABBREVIATION_RENTS: CmhcRentData = { bachelor: 1500, oneBed: 1800, twoBed: 2300, threeBed: 2800 };

function normalizeStr(s: string): string {
  return s.trim().toLowerCase()
    .replace(/[.''\u2019\u2018]/g, "")
    .replace(/\s+/g, " ");
}

export function getCmhcRent(bedrooms: number, city?: string, province?: string, country?: string): { rent: number; source: "cmhc_city" | "cmhc_province" | "default" } {
  const bedKey = Math.max(0, Math.min(bedrooms, 4));

  function pickRent(data: CmhcRentData): number {
    if (bedKey === 0) return data.bachelor;
    if (bedKey === 1) return data.oneBed;
    if (bedKey === 2) return data.twoBed;
    return data.threeBed;
  }

  const isUS = country === "US" || country === "USA";

  if (city) {
    const cityNorm = normalizeStr(city);

    for (const [key, data] of Object.entries(CMHC_CITY_RENTS)) {
      if (normalizeStr(key) === cityNorm) return { rent: pickRent(data), source: "cmhc_city" };
    }
    for (const [key, data] of Object.entries(US_CITY_RENTS)) {
      if (normalizeStr(key) === cityNorm) return { rent: pickRent(data), source: "cmhc_city" };
    }

    const cityWithParens = cityNorm.replace(/\s*\(.*?\)\s*/g, " ").trim();
    if (cityWithParens !== cityNorm) {
      for (const [key, data] of Object.entries(CMHC_CITY_RENTS)) {
        if (normalizeStr(key) === cityWithParens) return { rent: pickRent(data), source: "cmhc_city" };
      }
    }
  }

  if (province) {
    const provNorm = province.trim();

    if (provNorm === "CA" || provNorm === "ca") {
      if (isUS) {
        return { rent: pickRent(CA_ABBREVIATION_RENTS), source: "cmhc_province" };
      }
    }

    const caMatch = CMHC_PROVINCIAL_RENTS[provNorm] || CMHC_PROVINCIAL_RENTS_ABBREV[provNorm];
    if (caMatch) return { rent: pickRent(caMatch), source: "cmhc_province" };

    const usMatch = US_STATE_RENTS[provNorm];
    if (usMatch) return { rent: pickRent(usMatch), source: "cmhc_province" };

    const provLower = normalizeStr(provNorm);
    for (const [key, data] of Object.entries(CMHC_PROVINCIAL_RENTS)) {
      if (normalizeStr(key) === provLower) return { rent: pickRent(data), source: "cmhc_province" };
    }
    for (const [key, data] of Object.entries(US_STATE_RENTS)) {
      if (normalizeStr(key) === provLower) return { rent: pickRent(data), source: "cmhc_province" };
    }
  }

  const fallback: CmhcRentData = isUS
    ? { bachelor: 1100, oneBed: 1300, twoBed: 1600, threeBed: 1900 }
    : { bachelor: 950, oneBed: 1200, twoBed: 1500, threeBed: 1750 };

  return { rent: pickRent(fallback), source: "default" };
}
