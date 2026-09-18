export { genericExtractor } from "./extractors/generic";
export { realtorCaExtractor } from "./extractors/realtorCa";
export { zillowExtractor } from "./extractors/zillow";
export { redfinExtractor } from "./extractors/redfin";
export { rightmoveExtractor } from "./extractors/rightmove";
export { domainExtractor } from "./extractors/domain";
export { realestateAuExtractor } from "./extractors/realestateAu";
export { zooplaExtractor } from "./extractors/zoopla";
export { realtorComExtractor } from "./extractors/realtorCom";
export { homesComExtractor } from "./extractors/homesCom";
export { immoscoutExtractor } from "./extractors/immoscout";
export { selogerExtractor } from "./extractors/seloger";
export { idealistaExtractor } from "./extractors/idealista";
export { propertyguruExtractor } from "./extractors/propertyguru";

import { genericExtractor } from "./extractors/generic";
import { realtorCaExtractor } from "./extractors/realtorCa";
import { zillowExtractor } from "./extractors/zillow";
import { redfinExtractor } from "./extractors/redfin";
import { rightmoveExtractor } from "./extractors/rightmove";
import { domainExtractor } from "./extractors/domain";
import { realestateAuExtractor } from "./extractors/realestateAu";
import { zooplaExtractor } from "./extractors/zoopla";
import { realtorComExtractor } from "./extractors/realtorCom";
import { homesComExtractor } from "./extractors/homesCom";
import { immoscoutExtractor } from "./extractors/immoscout";
import { selogerExtractor } from "./extractors/seloger";
import { idealistaExtractor } from "./extractors/idealista";
import { propertyguruExtractor } from "./extractors/propertyguru";
import type { ListingExtractor } from "./types";

export const BUILTIN_EXTRACTORS: ListingExtractor[] = [
  realtorCaExtractor,
  realtorComExtractor,
  zillowExtractor,
  redfinExtractor,
  homesComExtractor,
  rightmoveExtractor,
  zooplaExtractor,
  domainExtractor,
  realestateAuExtractor,
  immoscoutExtractor,
  selogerExtractor,
  idealistaExtractor,
  propertyguruExtractor,
  genericExtractor,
];
