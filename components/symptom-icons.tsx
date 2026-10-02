import {
  Activity,
  BatteryLow,
  Brain,
  Ear,
  Hand,
  Plus,
  Thermometer,
  Toilet,
  Zap,
  createLucideIcon,
  type LucideIcon,
} from "lucide-react";
import { symptomPreset, type SymptomName } from "@/lib/symptoms";

// Original SVG paths share Lucide's 24px grid, rounded caps and currentColor.
const Cough = createLucideIcon("SymptomCough", [
  [
    "path",
    {
      d: "M10 21v-4H7a2 2 0 0 1-2-2v-2H3l2-3V8a5 5 0 0 1 10 0v3",
      key: "profile",
    },
  ],
  ["path", { d: "M13 13h4m-3 3 4 1m-1-7 4-1", key: "breath" }],
]);
const RunnyNose = createLucideIcon("SymptomRunnyNose", [
  [
    "path",
    {
      d: "M10 3c0 4-2 6-3 8-1 2 0 4 2 4h6c2 0 3-2 2-4l-1-2M10 15c0-2 4-2 4 0",
      key: "nose",
    },
  ],
  ["path", { d: "M12 17s-2 2-2 3a2 2 0 0 0 4 0c0-1-2-3-2-3Z", key: "drop" }],
]);
const Congestion = createLucideIcon("SymptomCongestion", [
  [
    "path",
    {
      d: "M11 3c0 4-2 6-3 8-1 2 0 4 2 4h5c2 0 3-2 2-4l-1-2M10 15c0-2 4-2 4 0",
      key: "nose",
    },
  ],
  ["path", { d: "m3 6 2 1m-3 4h2m-1 5 2-1M9 20h7", key: "pressure" }],
]);
const SoreThroat = createLucideIcon("SymptomSoreThroat", [
  [
    "path",
    { d: "M7 3v4c0 2 1 3 2 4v5l-4 4M17 3v4c0 2-1 3-2 4v5l4 4", key: "neck" },
  ],
  ["circle", { cx: "12", cy: "13", r: "2", key: "throat" }],
  ["path", { d: "M12 18v3", key: "neckline" }],
]);
const Dizziness = createLucideIcon("SymptomDizziness", [
  [
    "path",
    {
      d: "M20 11a8 8 0 1 1-8-8c4 0 6 2 6 5s-2 5-5 5a3 3 0 0 1-3-3c0-1 1-2 2-2",
      key: "spiral",
    },
  ],
  ["path", { d: "m18 12 2-2 2 2", key: "spin" }],
]);
const Stomachache = createLucideIcon("SymptomStomachache", [
  [
    "path",
    {
      d: "M10 3v5c0 2-2 3-2 6a6 6 0 0 0 12 0c0-4-2-7-5-7h-1V3",
      key: "stomach",
    },
  ],
  ["path", { d: "M8 15H6a2 2 0 0 0-2 2v4m9-10-2 3h4l-2 3", key: "discomfort" }],
]);
const Nausea = createLucideIcon("SymptomNausea", [
  ["circle", { cx: "12", cy: "12", r: "9", key: "face" }],
  ["path", { d: "M8 9h1m6 0h1M7 16q2-3 5 0t5 0", key: "expression" }],
]);
const Vomiting = createLucideIcon("SymptomVomiting", [
  [
    "path",
    {
      d: "M8 20v-4H6a2 2 0 0 1-2-2v-2H2l2-3V7a5 5 0 0 1 10 0v5M13 14l4 3m-4 0 3 2",
      key: "profile",
    },
  ],
  ["path", { d: "M15 20h7m-6-3 1 3m4-3-1 3", key: "bowl" }],
]);
const Constipation = createLucideIcon("SymptomConstipation", [
  [
    "path",
    { d: "M6 3v3c0 2 2 3 4 3h5a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h3", key: "gut" },
  ],
  ["path", { d: "M14 2v3M18 4v3M12 19v4", key: "slow" }],
]);
const Rash = createLucideIcon("SymptomRash", [
  ["path", { d: "M7 3h10l3 6-2 12H6L4 9 7 3Z", key: "skin" }],
  ["circle", { cx: "9", cy: "9", r: ".7", key: "spot1" }],
  ["circle", { cx: "14", cy: "8", r: ".7", key: "spot2" }],
  ["circle", { cx: "12", cy: "13", r: ".7", key: "spot3" }],
  ["circle", { cx: "9", cy: "17", r: ".7", key: "spot4" }],
  ["circle", { cx: "16", cy: "16", r: ".7", key: "spot5" }],
]);

const ICONS: Record<SymptomName, LucideIcon> = {
  Fever: Thermometer,
  Cough,
  "Runny nose": RunnyNose,
  Congestion,
  "Sore throat": SoreThroat,
  Earache: Ear,
  Headache: Brain,
  Dizziness,
  Pain: Zap,
  Fatigue: BatteryLow,
  Stomachache,
  Nausea,
  Vomiting,
  Diarrhea: Toilet,
  Constipation,
  Rash,
  Itching: Hand,
  "Other symptom": Plus,
};

export function symptomAppearance(name = "") {
  const preset = symptomPreset(name);
  return {
    icon: preset ? ICONS[preset.name] : Activity,
    color: preset?.color || "peach",
  };
}
