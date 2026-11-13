import { describe, expect, it } from "vitest";
import { checkPlaceholders, extractIcu, extractPlaceholders, lengthWarning } from "../src/placeholders";

describe("ICU plural and select", () => {
  const src = "{count, plural, =0{No items} one{1 item} other{{count} items}}";
  it("extracts the header, select keywords and the required plural 'other'", () => {
    expect(extractIcu(src)).toEqual(["{count, plural,", "count:other"]);
    expect(extractIcu("{g, select, male{He} female{She} other{They}} replied")).toEqual(["{g, select,", "g:male", "g:female", "g:other"]);
    expect(extractIcu("Hello {name}")).toEqual([]);
  });
  it("accepts each language's own plural categories", () => {
    // Polish: one, few, many, other. Arabic: zero, one, two, few, many, other. Japanese: other only.
    expect(checkPlaceholders(src, "{count, plural, =0{Brak} one{1 produkt} few{{count} produkty} many{{count} produktów} other{{count} produktu}}").ok).toBe(true);
    expect(checkPlaceholders(src, "{count, plural, zero{لا شيء} one{عنصر} two{عنصران} few{{count} عناصر} many{{count} عنصرًا} other{{count} عنصر}}").ok).toBe(true);
    expect(checkPlaceholders(src, "{count, plural, other{{count} 個}}").ok).toBe(true);
  });
  it("rejects translated keywords, a translated type, or a missing 'other'", () => {
    const bad = checkPlaceholders(src, "{count, pluriel, =0{Aucun} un{1 article} autre{{count} articles}}");
    expect(bad.ok).toBe(false);
    expect(bad.missing).toContain("{count, plural,");
    expect(checkPlaceholders(src, "{count, plural, one{1 article} autre{{count} articles}}").ok).toBe(false);
    expect(checkPlaceholders(src, "{count, plural, one{1 article} many{{count} articles}}").ok).toBe(false);
  });
  it("still requires the same select keywords", () => {
    const sel = "{g, select, male{He} female{She} other{They}}";
    expect(checkPlaceholders(sel, "{g, select, male{Il} female{Elle} other{Iel}}").ok).toBe(true);
    expect(checkPlaceholders(sel, "{g, select, homme{Il} femme{Elle} other{Iel}}").ok).toBe(false);
  });
});

describe("extractPlaceholders", () => {
  it("finds every style in order", () => {
    expect(extractPlaceholders("Hi {{ name }}, {count} new, %1$d of %2$s, %@ <b>x</b> %.2f %%")).toEqual([
      "{{name}}", "{count}", "%1$d", "%2$s", "%@", "<b>", "</b>", "%.2f", "%%",
    ]);
  });
  it("does not double count {x} inside {{x}}", () => {
    expect(extractPlaceholders("{{a}}")).toEqual(["{{a}}"]);
  });
  it("keeps tag attributes", () => {
    expect(extractPlaceholders('Read <a href="/terms">terms</a>')).toEqual(['<a href="/terms">', "</a>"]);
  });
  it("does not see a placeholder in French spacing before %", () => {
    expect(extractPlaceholders("{percent} % de remise")).toEqual(["{percent}"]);
  });
});

describe("checkPlaceholders", () => {
  it("accepts reordering", () => {
    expect(checkPlaceholders("%1$s sent %2$d", "%2$d envoyés par %1$s").ok).toBe(true);
  });
  it("reports missing and extra", () => {
    expect(checkPlaceholders("Pay {amount}", "Payer {montant}")).toEqual({ ok: false, missing: ["{amount}"], extra: ["{montant}"] });
  });
  it("counts duplicates", () => {
    expect(checkPlaceholders("{a} and {a}", "{a}").missing).toEqual(["{a}"]);
  });
  it("treats {{ a }} and {{a}} as the same", () => {
    expect(checkPlaceholders("Hi {{ a }}", "Hola {{a}}").ok).toBe(true);
  });
});

describe("lengthWarning", () => {
  it("allows short strings to grow", () => {
    expect(lengthWarning("OK", "Aceptar")).toBeNull();
  });
  it("flags long overflows", () => {
    expect(lengthWarning("Remove item", "x".repeat(30))).toMatch(/overflow/);
  });
});
