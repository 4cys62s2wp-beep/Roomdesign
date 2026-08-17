import { describe, expect, it } from "vitest";
import {
  CAMERA_SETTINGS,
  GUIDE_SECTIONS,
  QUICK_CHECKLIST,
  RECORDING_TARGETS,
  ROOM_STEPS,
  currentRoomStep,
  currentRoomStepIndex,
  durationVerdict,
} from "@/lib/capture-guide";

describe("Aufnahme-Standard", () => {
  it("deckt die Raum-Schritte lückenlos ab dem Betreten ab", () => {
    expect(ROOM_STEPS[0].fromSec).toBe(0);
    for (let i = 1; i < ROOM_STEPS.length; i++) {
      expect(ROOM_STEPS[i].fromSec, `Lücke vor Schritt ${i + 1}`).toBe(ROOM_STEPS[i - 1].toSec);
    }
    expect(ROOM_STEPS[ROOM_STEPS.length - 1].toSec).toBe(Number.POSITIVE_INFINITY);
  });

  it("liefert für jede Sekunde genau einen Schritt", () => {
    for (const seconds of [0, 3, 5.9, 6, 20, 25.9, 26, 90, 3600]) {
      const matches = ROOM_STEPS.filter((s) => seconds >= s.fromSec && seconds < s.toSec);
      expect(matches, `bei ${seconds}s`).toHaveLength(1);
      expect(currentRoomStep(seconds)).toBe(matches[0]);
    }
  });

  it("hält Schritt-Index und Schritt konsistent", () => {
    for (const seconds of [0, 6, 26, 500]) {
      expect(ROOM_STEPS[currentRoomStepIndex(seconds)]).toBe(currentRoomStep(seconds));
    }
  });

  it("verwendet die 360°-Drehdauer im zweiten Schritt", () => {
    const turnStep = ROOM_STEPS[1];
    expect(turnStep.toSec - turnStep.fromSec).toBe(RECORDING_TARGETS.fullTurnSec);
  });

  it("bewertet die Gesamtlänge sinnvoll", () => {
    expect(durationVerdict(20).level).toBe("short");
    expect(durationVerdict(RECORDING_TARGETS.totalTargetSec).level).toBe("good");
    expect(durationVerdict(RECORDING_TARGETS.totalWarnSec).level).toBe("good");
    expect(durationVerdict(RECORDING_TARGETS.totalWarnSec + 1).level).toBe("long");
  });

  it("hat plausible Zielwerte", () => {
    expect(RECORDING_TARGETS.totalTargetSec).toBeLessThan(RECORDING_TARGETS.totalWarnSec);
    expect(RECORDING_TARGETS.perRoomSec).toBeGreaterThan(0);
    expect(RECORDING_TARGETS.extractedFrames).toBeGreaterThan(0);
  });

  it("nennt eindeutig das 1×-Objektiv und warnt vor 0,5×", () => {
    const lensRule = CAMERA_SETTINGS[0];
    expect(lensRule.title).toContain("1×");
    expect(lensRule.detail).toContain("0,5×");
  });

  it("Kurzfassung und Abschnitte sind befüllt und ohne Dubletten", () => {
    expect(QUICK_CHECKLIST.length).toBeGreaterThanOrEqual(5);
    expect(new Set(QUICK_CHECKLIST).size).toBe(QUICK_CHECKLIST.length);

    const ids = GUIDE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const section of GUIDE_SECTIONS) {
      expect(section.items.length, section.id).toBeGreaterThan(0);
      for (const item of section.items) {
        expect(item.title.trim(), section.id).not.toBe("");
        expect(item.detail.trim(), section.id).not.toBe("");
      }
    }
  });
});
