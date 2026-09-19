import type { FormMap } from "../types";
import { orea100 } from "./orea-100";
import { orea101 } from "./orea-101";
import { orea105 } from "./orea-105";
import { orea200 } from "./orea-200";
import { orea300 } from "./orea-300";
import { orea320 } from "./orea-320";
import { orea400 } from "./orea-400";

export const FORM_MAPS: FormMap[] = [
  orea100,
  orea101,
  orea105,
  orea200,
  orea300,
  orea320,
  orea400,
];

export const FORM_MAP_BY_ID = new Map(FORM_MAPS.map((map) => [map.formId, map]));

export const FORM_IDS = FORM_MAPS.map((map) => map.formId);
