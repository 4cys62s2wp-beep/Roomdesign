#!/usr/bin/env node
// Entwicklungsserver mit HTTPS — und zwar so, dass er auch vom Handy aus
// funktioniert.
//
// `next dev --experimental-https` reicht dafür nicht: Es stellt ein Zertifikat
// nur für localhost/127.0.0.1/::1 aus, nicht für die Netzwerk-Adresse des
// Rechners, und ruft mkcert immer mit `-install` auf — das schreibt eine
// Zertifizierungsstelle in den System-Schlüsselbund und fragt nach dem
// Admin-Passwort. Für das Handy bringt dieser Eintrag nichts (es vertraut dem
// Rechner ja nicht), das Zertifikat passte aber trotzdem nicht zur Adresse.
//
// Dieses Skript stellt das Zertifikat deshalb selbst aus — für localhost UND
// jede lokale Netzwerk-Adresse, ohne `-install` und damit ohne Passwortfrage —
// und startet `next dev` damit.

import { execFileSync } from "node:child_process";
import { X509Certificate, createPrivateKey } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const MKCERT_VERSION = "v1.4.4";
const CERT_DIR = path.resolve(process.cwd(), "certificates");
const KEY_PATH = path.join(CERT_DIR, "local-network-key.pem");
const CERT_PATH = path.join(CERT_DIR, "local-network.pem");

// ---------------------------------------------------------------- Adressen

/** Alle IPv4-Adressen, unter denen dieser Rechner im lokalen Netz erreichbar ist. */
function localNetworkAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((info) => info && info.family === "IPv4" && !info.internal)
    .map((info) => info.address)
    .sort();
}

// ------------------------------------------------------------------ mkcert

function mkcertBinaryName() {
  const arch = process.arch === "x64" ? "amd64" : process.arch;
  if (process.platform === "win32") return `mkcert-${MKCERT_VERSION}-windows-${arch}.exe`;
  return `mkcert-${MKCERT_VERSION}-${process.platform}-${arch}`;
}

/**
 * Denselben Cache-Ort benutzen wie Next.js, damit ein bereits geladenes
 * mkcert wiederverwendet wird statt es ein zweites Mal herunterzuladen.
 */
function mkcertCachePath() {
  const name = mkcertBinaryName();
  const home = os.homedir();
  if (process.platform === "darwin") return path.join(home, "Library", "Caches", "mkcert", name);
  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "mkcert", name);
  }
  return path.join(process.env.XDG_CACHE_HOME ?? path.join(home, ".cache"), "mkcert", name);
}

function mkcertOnPath() {
  try {
    const which = process.platform === "win32" ? "where" : "which";
    return execFileSync(which, ["mkcert"], { encoding: "utf8" }).split("\n")[0].trim() || null;
  } catch {
    return null;
  }
}

async function resolveMkcert() {
  const onPath = mkcertOnPath();
  if (onPath) return onPath;

  const cached = mkcertCachePath();
  if (fs.existsSync(cached)) return cached;

  const url = `https://github.com/FiloSottile/mkcert/releases/download/${MKCERT_VERSION}/${mkcertBinaryName()}`;
  console.log(`→ Lade mkcert herunter (einmalig)\n  ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `mkcert konnte nicht geladen werden (HTTP ${response.status}).\n` +
        `Installiere es stattdessen von Hand: brew install mkcert`,
    );
  }
  fs.mkdirSync(path.dirname(cached), { recursive: true });
  fs.writeFileSync(cached, Buffer.from(await response.arrayBuffer()));
  fs.chmodSync(cached, 0o755);
  return cached;
}

// ------------------------------------------------------------- Zertifikat

/** Deckt das vorhandene Zertifikat noch alle Adressen ab und passt der Schlüssel dazu? */
function certificateCovers(hosts) {
  if (!fs.existsSync(KEY_PATH) || !fs.existsSync(CERT_PATH)) return false;
  try {
    const cert = new X509Certificate(fs.readFileSync(CERT_PATH));
    if (!cert.checkPrivateKey(createPrivateKey(fs.readFileSync(KEY_PATH)))) return false;
    // Abgelaufene Zertifikate erneuern, bevor der Browser sie ablehnt
    if (new Date(cert.validTo).getTime() < Date.now()) return false;
    return hosts.every((host) => (isIp(host) ? cert.checkIP(host) : cert.checkHost(host)));
  } catch {
    return false;
  }
}

function isIp(host) {
  return /^[\d.]+$/.test(host) || host.includes(":");
}

async function ensureCertificate(hosts) {
  if (certificateCovers(hosts)) {
    console.log("✓ Vorhandenes Zertifikat passt zu allen Adressen");
    return;
  }

  const mkcert = await resolveMkcert();
  fs.mkdirSync(CERT_DIR, { recursive: true });
  console.log(`→ Stelle Zertifikat aus für: ${hosts.join(", ")}`);
  // Bewusst OHNE -install: Das würde eine Zertifizierungsstelle in den
  // System-Schlüsselbund schreiben und nach dem Admin-Passwort fragen. Dem
  // Handy hilft dieser Eintrag ohnehin nicht.
  execFileSync(mkcert, ["-key-file", KEY_PATH, "-cert-file", CERT_PATH, ...hosts], {
    stdio: ["ignore", "ignore", "inherit"],
  });

  let caRoot = null;
  try {
    caRoot = execFileSync(mkcert, ["-CAROOT"], { encoding: "utf8" }).trim();
  } catch {
    // Nur ein Hinweis — ohne CAROOT läuft der Server trotzdem
  }
  console.log(`✓ Zertifikat liegt in ${path.relative(process.cwd(), CERT_DIR)}/`);
  if (caRoot) {
    console.log(`  Zertifizierungsstelle: ${path.join(caRoot, "rootCA.pem")}`);
    console.log(`  Damit dieser Rechner nicht mehr warnt, einmalig: ${mkcert} -install`);
  }
}

// ---------------------------------------------------------------------- Port

/**
 * Den Port selbst festlegen, statt ihn Next.js suchen zu lassen: Nur so kann
 * unten die richtige Handy-Adresse ausgegeben werden — sonst stünde dort 3000,
 * während der Server auf 3001 ausgewichen ist.
 */
async function freePort(start) {
  for (let port = start; port < start + 20; port++) {
    const free = await new Promise((resolve) => {
      const probe = createServer();
      probe.once("error", () => resolve(false));
      probe.once("listening", () => probe.close(() => resolve(true)));
      probe.listen(port, "0.0.0.0");
    });
    if (free) return port;
  }
  return start;
}

// ----------------------------------------------------------------- Starten

const args = process.argv.slice(2);
const addresses = localNetworkAddresses();
const hosts = ["localhost", "127.0.0.1", "::1", ...addresses];

// Eine selbst gesetzte Portangabe hat Vorrang
const explicitPort = args.includes("-p") || args.includes("--port") || process.env.PORT;
const port = explicitPort ? null : await freePort(3000);

try {
  await ensureCertificate(hosts);
} catch (error) {
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}`);
  console.error(
    "\nOhne HTTPS geht es auch: `npm run dev` starten und das Video auf dem Handy\n" +
      "über „Video hochladen“ aufnehmen — dafür wird kein Zertifikat gebraucht.",
  );
  process.exit(1);
}

if (addresses.length === 0) {
  console.log("\n! Keine Netzwerk-Adresse gefunden — bist du mit dem WLAN verbunden?");
} else if (port) {
  console.log("\nAuf dem Handy (gleiches WLAN) aufrufen:");
  for (const address of addresses) console.log(`  https://${address}:${port}`);
  console.log(
    "\nDer Browser warnt beim ersten Aufruf, weil das Zertifikat selbst ausgestellt ist.\n" +
      "Bestätige die Warnung („Erweitert“ → „Trotzdem fortfahren“), danach gibt er die Kamera frei.",
  );
}

const next = spawn(
  process.execPath,
  [
    path.resolve("node_modules/next/dist/bin/next"),
    "dev",
    // Das Flag schaltet den Server auf HTTPS. Weil Schlüssel und Zertifikat
    // mitgegeben werden, erzeugt Next.js keins mehr selbst — und fragt damit
    // auch nicht nach dem Admin-Passwort.
    "--experimental-https",
    "--experimental-https-key",
    KEY_PATH,
    "--experimental-https-cert",
    CERT_PATH,
    ...(port ? ["--port", String(port)] : []),
    ...args,
  ],
  { stdio: "inherit" },
);

next.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
