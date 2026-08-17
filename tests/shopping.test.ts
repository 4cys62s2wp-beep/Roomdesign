import { describe, expect, it } from "vitest";
import { buildCsv } from "@/lib/shopping";

describe("CSV-Export", () => {
  it("erzeugt Kopfzeile und escaped Anführungszeichen", () => {
    const csv = buildCsv([
      {
        roomName: "Wohnzimmer",
        proposalTitle: 'Japandi "Ruhe"',
        label: "Sofa; groß",
        category: "Sofa",
        dimensions: "200×90×78 cm",
        priceEur: 899,
        searchQuery: "Sofa Leinen beige",
      },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toContain('"Raum"');
    expect(lines[1]).toContain('"Japandi ""Ruhe"""');
    expect(lines[1]).toContain('"Sofa; groß"');
    expect(lines[1]).toContain('"899"');
  });

  it("liefert nur die Kopfzeile bei leerer Liste", () => {
    const csv = buildCsv([]);
    expect(csv.split("\r\n")).toHaveLength(1);
  });
});
