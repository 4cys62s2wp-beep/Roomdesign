// Einkaufslisten-Typen + CSV-Export (getrennt von der Route, damit testbar
// und weil Next.js in route.ts nur Handler-Exporte erlaubt).

export interface ShoppingItem {
  roomName: string;
  proposalTitle: string;
  label: string;
  category: string;
  dimensions: string;
  priceEur: number;
  searchQuery: string;
}

export function buildCsv(items: ShoppingItem[]): string {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const header = ["Raum", "Vorschlag", "Artikel", "Kategorie", "Maße", "Preis (EUR)", "Suchbegriff"];
  const lines = [header.map(escape).join(";")];
  for (const item of items) {
    lines.push(
      [
        item.roomName,
        item.proposalTitle,
        item.label,
        item.category,
        item.dimensions,
        item.priceEur.toFixed(0),
        item.searchQuery,
      ]
        .map(escape)
        .join(";"),
    );
  }
  // BOM für Excel-Kompatibilität (Umlaute)
  return "﻿" + lines.join("\r\n");
}
