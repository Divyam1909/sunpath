import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import mr from "../../messages/mr.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...all, [path]: value } : { ...all, ...flatten(value, path) };
  }, {});
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const english = flatten(en);

describe.each([
  ["mr", flatten(mr)],
  ["hi", flatten(hi)],
])("%s translations", (_, messages) => {
  it("have exactly the English keys", () => {
    expect(Object.keys(messages).sort()).toEqual(Object.keys(english).sort());
  });

  it("keep every placeholder", () => {
    for (const [key, text] of Object.entries(english)) {
      expect(placeholders(messages[key]), key).toEqual(placeholders(text));
    }
  });

  it("are actually translated, apart from names and formulas", () => {
    const allowedSame = new Set(["brand.name", "quote.howSubsidyLine", "quote.howNet"]);
    for (const [key, text] of Object.entries(english)) {
      if (!allowedSame.has(key) && !/^\{.*\}$/.test(text)) expect(messages[key], key).not.toBe(text);
    }
  });
});
