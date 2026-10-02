import {
  Activity,
  ArrowUpFromLine,
  BatteryLow,
  CircleDot,
  CircleMinus,
  CloudFog,
  Droplet,
  Ear,
  Grip,
  Hand,
  Mic,
  Pause,
  Plus,
  RotateCcw,
  Thermometer,
  Toilet,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { symptomPreset, type SymptomName } from "@/lib/symptoms";

// Library symbols keep one consistent line style alongside the symptom labels.
const ICONS: Record<SymptomName, LucideIcon> = {
  Fever: Thermometer,
  Cough: Wind,
  "Runny nose": Droplet,
  Congestion: CloudFog,
  "Sore throat": Mic,
  Earache: Ear,
  Headache: CircleDot,
  Dizziness: RotateCcw,
  Pain: Zap,
  Fatigue: BatteryLow,
  Stomachache: CircleMinus,
  Nausea: Waves,
  Vomiting: ArrowUpFromLine,
  Diarrhea: Toilet,
  Constipation: Pause,
  Rash: Grip,
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
