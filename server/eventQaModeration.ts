// Server-only: do not ship the rejection dictionary to the public feed.
// Human approval is also required: no dictionary catches every abusive message.
export const DEFAULT_REJECTED_WORDS = [
  "fuck",
  "fucks",
  "fucked",
  "fucker",
  "fuckers",
  "fucking",
  "motherfucker",
  "motherfucking",
  "shit",
  "shits",
  "shitty",
  "bullshit",
  "horseshit",
  "shithead",
  "asshole",
  "assholes",
  "arsehole",
  "bitch",
  "bitches",
  "bitching",
  "bastard",
  "bastards",
  "cunt",
  "cunts",
  "dick",
  "dickhead",
  "cock",
  "cocksucker",
  "pussy",
  "twat",
  "wanker",
  "whore",
  "slut",
  "porn",
  "porno",
  "pornography",
  "blowjob",
  "handjob",
  "nigger",
  "niggers",
  "nigga",
  "niggas",
  "faggot",
  "faggots",
  "kike",
  "kikes",
  "chink",
  "chinks",
  "spic",
  "spics",
  "tranny",
  "retard",
  "retarded",
  "heil hitler",
  "sieg heil",
  "kill yourself",
  "kys",
] as const;

const equivalents: Record<string, string> = {
  "0": "o",
  "1": "i",
  "!": "i",
  "3": "e",
  "4": "a",
  "@": "a",
  "5": "s",
  $: "s",
  "7": "t",
  "8": "b",
  а: "a",
  е: "e",
  і: "i",
  о: "o",
  с: "c",
  р: "p",
  х: "x",
  у: "y",
  ѕ: "s",
  к: "k",
};

export function normalizeQuestionText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\p{Cf}\p{Cc}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function filterText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .replace(/[0134578!@$аеіосрхуѕк]/g, (char) => equivalents[char] || char);
}

const patternCache = new Map<string, RegExp[]>();
function rejectionPatterns(additional: readonly string[]) {
  const key = JSON.stringify(additional);
  const cached = patternCache.get(key);
  if (cached) return cached;
  const patterns = [...DEFAULT_REJECTED_WORDS, ...additional].flatMap(
    (word) => {
      const letters = filterText(word).replace(/[^\p{L}\p{N}]/gu, "");
      if (!letters) return [];
      // Boundaries preserve legitimate words such as "class", "Scunthorpe" and "assessment".
      // Optional separators and repeated characters catch f.u.c.k, f u c k and fuuuck.
      const pattern = [...letters]
        .map((char) => `${char}+`)
        .join("[^\\p{L}\\p{N}]*");
      return [
        new RegExp(`(?:^|[^\\p{L}\\p{N}])${pattern}(?=$|[^\\p{L}\\p{N}])`, "u"),
      ];
    },
  );
  if (patternCache.size >= 8) patternCache.clear();
  patternCache.set(key, patterns);
  return patterns;
}

export function containsRejectedWords(
  body: string,
  additional: readonly string[] = [],
): boolean {
  const plain = body
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\p{M}\p{Cf}]/gu, "");
  const normalized = filterText(body);
  return rejectionPatterns(additional).some(
    (matcher) => matcher.test(plain) || matcher.test(normalized),
  );
}
