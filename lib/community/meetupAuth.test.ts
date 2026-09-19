import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MEETUP_TOKEN_URL,
  buildMeetupJwtAssertion,
  getMeetupAccessToken,
  meetupJwtConfigured,
  resetMeetupTokenCache,
} from "./meetupAuth";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
const now = new Date("2026-09-18T12:00:00Z");

function verify(jwt: string, key: crypto.KeyObject): boolean {
  const [header, claims, signature] = jwt.split(".");
  return crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${header}.${claims}`, "utf8"),
    key,
    Buffer.from(signature, "base64url"),
  );
}

function decode(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

const ENV_KEYS = [
  "MEETUP_ACCESS_TOKEN",
  "MEETUP_CLIENT_ID",
  "MEETUP_JWT_PRIVATE_KEY",
  "MEETUP_JWT_KEY_ID",
  "MEETUP_AUTHORIZED_MEMBER_ID",
];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  resetMeetupTokenCache();
  vi.unstubAllGlobals();
});

describe("buildMeetupJwtAssertion", () => {
  it("produces an RS256 JWT with Meetup's claims that verifies against the public key", () => {
    const jwt = buildMeetupJwtAssertion({ clientId: "client-key", memberId: "424242", privateKeyPem: pem, now });
    const [header, claims] = jwt.split(".");
    expect(decode(header)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(decode(claims)).toEqual({
      sub: "424242",
      iss: "client-key",
      aud: "api.meetup.com",
      exp: Math.floor(now.getTime() / 1000) + 120,
    });
    expect(verify(jwt, publicKey)).toBe(true);
  });

  it("carries the signing key id as the kid header so Meetup can pick the public key", () => {
    const jwt = buildMeetupJwtAssertion({
      clientId: "client-key",
      memberId: "424242",
      privateKeyPem: pem,
      keyId: "signing-key-id",
      now,
    });
    expect(decode(jwt.split(".")[0])).toEqual({ kid: "signing-key-id", typ: "JWT", alg: "RS256" });
    expect(verify(jwt, publicKey)).toBe(true);
  });

  it("accepts a single-line PEM with literal \\n escapes (how it lands in env vars)", () => {
    const escaped = `"${pem.replace(/\n/g, "\\n")}"`;
    const jwt = buildMeetupJwtAssertion({ clientId: "c", memberId: "m", privateKeyPem: escaped, now });
    expect(verify(jwt, publicKey)).toBe(true);
  });
});

describe("getMeetupAccessToken", () => {
  it("returns null when nothing is configured, without touching the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(meetupJwtConfigured()).toBe(false);
    expect(await getMeetupAccessToken(now)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefers a static access token over the JWT flow", async () => {
    process.env.MEETUP_ACCESS_TOKEN = "static-token";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await getMeetupAccessToken(now)).toBe("static-token");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mints a token through the JWT grant and caches it until just before expiry", async () => {
    process.env.MEETUP_CLIENT_ID = "client-key";
    process.env.MEETUP_AUTHORIZED_MEMBER_ID = "424242";
    process.env.MEETUP_JWT_PRIVATE_KEY = pem;
    process.env.MEETUP_JWT_KEY_ID = "signing-key-id";

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: "minted", expires_in: 3600 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await getMeetupAccessToken(now)).toBe("minted");
    expect(await getMeetupAccessToken(new Date(now.getTime() + 30 * 60 * 1000))).toBe("minted");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(MEETUP_TOKEN_URL);
    const body = new URLSearchParams(String(init.body));
    expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    const assertion = body.get("assertion")!;
    expect(decode(assertion.split(".")[0]).kid).toBe("signing-key-id");
    expect(verify(assertion, publicKey)).toBe(true);

    // Past expiry minus the 60s margin, a fresh token is minted.
    await getMeetupAccessToken(new Date(now.getTime() + 3600 * 1000));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when credentials exist but the exchange fails, so callers fall back", async () => {
    process.env.MEETUP_CLIENT_ID = "client-key";
    process.env.MEETUP_AUTHORIZED_MEMBER_ID = "424242";
    process.env.MEETUP_JWT_PRIVATE_KEY = pem;
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    await expect(getMeetupAccessToken(now)).rejects.toThrow(/HTTP 401/);
  });
});
