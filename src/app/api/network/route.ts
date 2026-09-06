import os from "node:os";
import { NextRequest, NextResponse } from "next/server";

// Unter welcher Adresse erreicht das Handy diesen Server? Der Assistent zeigt
// daraus einen QR-Code. Die Adressen stammen vom Rechner, auf dem der Server
// läuft; Port und Protokoll von der Anfrage, die gerade hereinkam.

export async function GET(request: NextRequest) {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((info) => info && info.family === "IPv4" && !info.internal)
    .map((info) => info!.address)
    .sort();

  const url = request.nextUrl;
  const secure = url.protocol === "https:";
  const port = url.port || (secure ? "443" : "80");

  return NextResponse.json({
    addresses,
    port,
    protocol: secure ? "https" : "http",
    secure,
    hostname: os.hostname(),
  });
}
