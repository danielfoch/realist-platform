import { describe, expect, it } from "vitest";
import {
  extractUnits,
  looseAddressKey,
  looseKeyFromListingAddress,
  parseRollUnit,
} from "./quebecRoll";

// Verbatim from the real RL02010_2026.xml (Sainte-Thérèse-de-Gaspé):
// a CUBF-1000 single-family unit built 2022.
const RESIDENTIAL_UNIT = `<RLUEx>
    <RL0101>
      <RL0101x>
        <RL0101Ax>47</RL0101Ax>
        <RL0101Ex>CH</RL0101Ex>
        <RL0101Fx>J</RL0101Fx>
        <RL0101Gx>SAINT-ISIDORE</RL0101Gx>
      </RL0101x>
    </RL0101>
    <RL0103>
      <RL0103x>
        <RL0103Ax>5648619</RL0103Ax>
      </RL0103x>
    </RL0103>
    <RL0104>
      <RL0104A>0668</RL0104A>
      <RL0104B>90</RL0104B>
      <RL0104C>0333</RL0104C>
    </RL0104>
    <RL0105A>1000</RL0105A>
    <RL0106A>80015100</RL0106A>
    <RL0107A>1108</RL0107A>
    <RL0301A>48.77</RL0301A>
    <RL0302A>177977.00</RL0302A>
    <RL0303A>0</RL0303A>
    <RL0306A>1</RL0306A>
    <RL0307A>2022</RL0307A>
    <RL0307B>R</RL0307B>
    <RL0308A>92.3</RL0308A>
    <RL0309A>1</RL0309A>
    <RL0310A>1</RL0310A>
    <RL0311A>1</RL0311A>
    <RL0401A>2023-07-01</RL0401A>
    <RL0402A>35200</RL0402A>
    <RL0403A>179100</RL0403A>
    <RL0404A>214300</RL0404A>
    <RL0405A>125100</RL0405A>
    <RL0501A>0</RL0501A>
  </RLUEx>`;

// Vacant land (CUBF 9100): no building fields, no civic number.
const VACANT_UNIT = `<RLUEx>
    <RL0101>
      <RL0101x>
        <RL0101Gx>3E RANG</RL0101Gx>
      </RL0101x>
    </RL0101>
    <RL0104>
      <RL0104A>0568</RL0104A>
      <RL0104B>97</RL0104B>
      <RL0104C>9054</RL0104C>
    </RL0104>
    <RL0105A>9100</RL0105A>
    <RL0302A>500.20</RL0302A>
    <RL0401A>2023-07-01</RL0401A>
    <RL0402A>900</RL0402A>
    <RL0404A>900</RL0404A>
  </RLUEx>`;

describe("parseRollUnit", () => {
  it("parses a real residential unit exactly", () => {
    const u = parseRollUnit(RESIDENTIAL_UNIT);
    expect(u.matricule).toBe("0668-90-0333");
    expect(u.lotNumber).toBe("5648619");
    expect(u.civicNumber).toBe("47");
    expect(u.streetGenericCode).toBe("CH");
    expect(u.streetName).toBe("SAINT-ISIDORE");
    expect(u.address).toBe("47 Chemin Saint-Isidore");
    expect(u.cubf).toBe("1000");
    expect(u.frontageM).toBe(48.77);
    expect(u.lotAreaM2).toBe(177977);
    expect(u.storeys).toBe(1);
    expect(u.yearBuilt).toBe(2022);
    expect(u.yearBuiltEstimated).toBe(false);
    expect(u.floorAreaM2).toBe(92.3);
    expect(u.dwellings).toBe(1);
    expect(u.marketRefDate).toBe("2023-07-01");
    expect(u.landValue).toBe(35200);
    expect(u.buildingValue).toBe(179100);
    expect(u.totalValue).toBe(214300);
    expect(u.previousRollValue).toBe(125100);
  });

  it("parses vacant land with nulls for absent building fields", () => {
    const u = parseRollUnit(VACANT_UNIT);
    expect(u.cubf).toBe("9100");
    expect(u.civicNumber).toBeNull();
    expect(u.address).toBe("3e Rang");
    expect(u.yearBuilt).toBeNull();
    expect(u.floorAreaM2).toBeNull();
    expect(u.dwellings).toBeNull();
    expect(u.buildingValue).toBeNull();
    expect(u.totalValue).toBe(900);
  });

  it("decodes XML entities in street names", () => {
    const u = parseRollUnit(
      `<RLUEx><RL0101><RL0101x><RL0101Ax>5</RL0101Ax><RL0101Ex>RUE</RL0101Ex><RL0101Gx>C&#212;TE D&apos;ABRAHAM</RL0101Gx></RL0101x></RL0101></RLUEx>`,
    );
    expect(u.streetName).toBe("CÔTE D'ABRAHAM");
    expect(u.address).toBe("5 Rue Côte D'Abraham");
  });
});

describe("address keys", () => {
  it("roll side and listing side produce the same loose key", () => {
    const rollKey = looseAddressKey("47", "SAINT-ISIDORE");
    expect(rollKey).toBe("47 saint isidore");
    expect(looseKeyFromListingAddress("47 Chemin Saint-Isidore")).toBe(rollKey);
    expect(looseKeyFromListingAddress("47 Ch. St-Isidore")).toBe(rollKey);
    expect(looseKeyFromListingAddress("47 St-Isidore, Sainte-Thérèse-de-Gaspé")).toMatch(/^47 saint isidore/);
  });

  it("expands st/ste to saint/sainte on both sides", () => {
    expect(looseAddressKey("12", "ST-DENIS")).toBe("12 saint denis");
    expect(looseKeyFromListingAddress("12 Rue St-Denis")).toBe("12 saint denis");
    expect(looseKeyFromListingAddress("12 Ste-Catherine")).toBe("12 sainte catherine");
  });

  it("strips unit prefixes and accents", () => {
    expect(looseKeyFromListingAddress("305 Boul. Curé-Labelle unit 4")).toBe("305 cure labelle");
  });

  it("returns null when there is no civic number", () => {
    expect(looseAddressKey(null, "SAINT-ISIDORE")).toBeNull();
    expect(looseKeyFromListingAddress("Chemin sans numéro")).toBeNull();
  });
});

describe("extractUnits", () => {
  it("extracts complete units and keeps a split tail", () => {
    const one = extractUnits(`<RL><VERSION>2.6</VERSION>${RESIDENTIAL_UNIT}${VACANT_UNIT}<RLU`);
    expect(one.units).toHaveLength(2);
    expect(one.rest.endsWith("<RLU")).toBe(true);

    const two = extractUnits(one.rest + "Ex><RL0105A>1000</RL0105A></RLUEx></RL>");
    expect(two.units).toHaveLength(1);
    expect(parseRollUnit(two.units[0]).cubf).toBe("1000");
  });

  it("keeps an incomplete unit buffered until its close tag arrives", () => {
    const head = RESIDENTIAL_UNIT.slice(0, 200);
    const { units, rest } = extractUnits(head);
    expect(units).toHaveLength(0);
    expect(rest).toBe(head);
    const done = extractUnits(rest + RESIDENTIAL_UNIT.slice(200));
    expect(done.units).toHaveLength(1);
  });
});
