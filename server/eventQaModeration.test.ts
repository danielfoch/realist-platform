import { describe, expect, it } from "vitest";
import {
  containsRejectedWords,
  normalizeQuestionText,
} from "./eventQaModeration";

describe("event question rejection filter", () => {
  it.each([
    "fuck!",
    "FUCK",
    "f.u.c.k",
    "f u c k",
    "fuuuck",
    "f\u200buck",
    "ｆｕｃｋ",
    "fück",
    "sh!t",
    "$hit",
    "a$$hole",
    "fucking",
    "What the shit?",
    "kill yourself",
  ])("rejects %s", (word) => {
    expect(containsRejectedWords(`A question: ${word}`)).toBe(true);
  });
  it.each([
    "How do you assess a property?",
    "What is the asset class?",
    "Can Scunthorpe build multiplexes?",
    "How do construction costs affect financing?",
    "Is Dickenson Road eligible?",
    "Should we assume higher interest rates?",
    "How do you assemble land?",
    "Are cocktails served?",
  ])("allows %s", (body) => {
    expect(containsRejectedWords(body)).toBe(false);
  });
  it("supports additional phrases and does not interpret regex", () => {
    expect(
      containsRejectedWords("Please contact this scam agency now", [
        "scam agency",
      ]),
    ).toBe(true);
    expect(
      containsRejectedWords("The answer is completely ordinary", ["[.*]"]),
    ).toBe(false);
  });
  it("strips control and bidi characters before storing text", () => {
    expect(normalizeQuestionText("  How\ncan\u202e we build?  ")).toBe(
      "How can we build?",
    );
  });
});
