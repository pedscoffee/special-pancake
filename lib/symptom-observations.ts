import { symptomPreset } from "./symptoms";
import type { Log } from "./types";

export type ObservationField = {
  key: string;
  label: string;
  options?: readonly string[];
  placeholder?: string;
};
type Observation = { fields: ObservationField[]; countLabel?: string };
const pattern: ObservationField = {
  key: "pattern",
  label: "Pattern",
  options: ["Comes and goes", "Ongoing", "Not sure"],
};
const location: ObservationField = {
  key: "location",
  label: "Where is it?",
  placeholder: "e.g. Left knee, forehead, or behind the ears",
};
const countedPeriod: ObservationField = {
  key: "period",
  label: "Count covers",
  options: [
    "Today so far",
    "Since the previous observation",
    "Another period (describe in notes)",
  ],
};
const OBSERVATIONS: Record<string, Observation> = {
  Fever: {
    fields: [
      {
        key: "method",
        label: "Temperature taken",
        options: [
          "Underarm",
          "Mouth",
          "Ear",
          "Forehead",
          "Rectal",
          "Other",
          "Not sure",
        ],
      },
    ],
  },
  Cough: {
    fields: [
      {
        key: "sound",
        label: "Cough sound",
        options: ["Dry", "Wet or mucusy", "Barking", "Not sure"],
      },
      {
        key: "frequency",
        label: "How often?",
        options: ["Occasionally", "In bouts", "Frequently", "Not sure"],
      },
    ],
  },
  "Runny nose": {
    fields: [
      {
        key: "amount",
        label: "Nasal drainage",
        options: [
          "A little",
          "Frequent wiping",
          "Almost constantly running",
          "Not sure",
        ],
      },
      {
        key: "appearance",
        label: "Drainage description",
        options: ["Clear and watery", "Thicker mucus", "Varies", "Not sure"],
      },
    ],
  },
  Congestion: {
    fields: [
      {
        key: "side",
        label: "Blocked nose",
        options: ["One side", "Both sides", "Comes and goes", "Not sure"],
      },
      {
        key: "impact",
        label: "What is it interrupting?",
        options: [
          "Nothing noticed",
          "Sleep",
          "Eating or feeding",
          "Both sleep and feeding",
          "Not sure",
        ],
      },
    ],
  },
  "Sore throat": {
    fields: [
      {
        key: "pattern",
        label: "When does it hurt?",
        options: [
          "When swallowing",
          "Even without swallowing",
          "Both",
          "Not sure",
        ],
      },
      {
        key: "impact",
        label: "Eating and drinking",
        options: [
          "As usual",
          "Eating less",
          "Drinking less",
          "Both less",
          "Not sure",
        ],
      },
    ],
  },
  Earache: {
    fields: [
      {
        key: "side",
        label: "Which ear?",
        options: ["Left", "Right", "Both", "Not sure"],
      },
      pattern,
    ],
  },
  Headache: { fields: [location, pattern] },
  Dizziness: {
    fields: [
      {
        key: "feeling",
        label: "How do they describe it?",
        options: ["Lightheaded", "Spinning", "Unsteady", "Not sure"],
      },
      {
        key: "when",
        label: "When noticed?",
        options: [
          "On standing up",
          "When moving",
          "While still",
          "Varies",
          "Not sure",
        ],
      },
    ],
  },
  Pain: {
    fields: [
      location,
      {
        key: "feeling",
        label: "Pain description",
        options: ["Aching", "Sharp", "Burning", "Cramping", "Not sure"],
      },
      pattern,
    ],
  },
  Fatigue: {
    fields: [
      {
        key: "activity",
        label: "Energy and activity",
        options: [
          "Less energetic than usual",
          "Needs more breaks",
          "Resting much of the day",
          "Not sure",
        ],
      },
      {
        key: "sleep",
        label: "Sleep compared with usual",
        options: ["More", "About the same", "Less", "Not sure"],
      },
    ],
  },
  Stomachache: {
    fields: [
      {
        key: "location",
        label: "Where in their tummy?",
        options: [
          "Upper tummy",
          "Lower tummy",
          "Around the belly button",
          "All over",
          "Not sure",
        ],
      },
      pattern,
    ],
  },
  Nausea: {
    fields: [
      pattern,
      {
        key: "noticed",
        label: "What did you notice?",
        options: [
          "Says they feel queasy",
          "Gagging",
          "Avoiding food",
          "Not sure",
        ],
      },
    ],
  },
  Vomiting: {
    countLabel: "Vomiting episodes",
    fields: [
      countedPeriod,
      {
        key: "amount",
        label: "Amount each time",
        options: ["A small amount", "A larger amount", "Varies", "Not sure"],
      },
      {
        key: "fluids",
        label: "Keeping fluids down?",
        options: ["Yes", "Some", "No", "Not tried", "Not sure"],
      },
    ],
  },
  Diarrhea: {
    countLabel: "Loose or watery bowel movements",
    fields: [
      countedPeriod,
      {
        key: "consistency",
        label: "Stool description",
        options: ["Loose pieces", "Mushy", "Watery", "Varies", "Not sure"],
      },
    ],
  },
  Constipation: {
    fields: [
      {
        key: "noticed",
        label: "What did you notice?",
        options: [
          "Hard or lumpy stool",
          "Difficult or painful to pass",
          "Straining with little output",
          "No stool passed",
          "Not sure",
        ],
      },
    ],
  },
  Rash: {
    fields: [
      location,
      {
        key: "appearance",
        label: "Rash appearance",
        options: [
          "Flat patches",
          "Raised spots",
          "Small bumps",
          "Blisters",
          "Varies",
          "Not sure",
        ],
      },
      {
        key: "extent",
        label: "How much skin?",
        options: [
          "One small area",
          "Several areas",
          "Much of the body",
          "Not sure",
        ],
      },
    ],
  },
  Itching: {
    fields: [
      location,
      {
        key: "skin",
        label: "Skin appearance",
        options: ["Visible rash", "No visible rash", "Not sure"],
      },
      {
        key: "impact",
        label: "Scratching",
        options: [
          "Occasionally",
          "Frequently",
          "Interrupting sleep",
          "Not sure",
        ],
      },
    ],
  },
};

export function symptomObservation(name = ""): Observation {
  return OBSERVATIONS[symptomPreset(name)?.name || ""] || { fields: [] };
}

export function parseSymptomDetails(name: string, input: unknown) {
  if (input === undefined) return undefined;
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Symptom details must contain supported observations.");
  const fields = symptomObservation(name).fields;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const field = fields.find((f) => f.key === key);
    if (
      !field ||
      typeof value !== "string" ||
      !value.trim() ||
      value.length > 200 ||
      (field.options && !field.options.includes(value))
    )
      throw new Error("A symptom contains an unsupported observation.");
    result[key] = value.trim();
  }
  return Object.keys(result).length ? result : undefined;
}

export function validateSymptomData(data: Log["data"]) {
  parseSymptomDetails(data.symptomName || "", data.symptomDetails);
  if (data.symptomCount !== undefined) {
    if (
      !symptomObservation(data.symptomName).countLabel ||
      !Number.isInteger(data.symptomCount) ||
      data.symptomCount < 0 ||
      data.symptomCount > 999
    )
      throw new Error(
        "Symptom counts must be whole numbers from 0 to 999 for a supported symptom.",
      );
    if (!data.symptomDetails?.period)
      throw new Error("Choose the period covered by this symptom count.");
  }
  if (
    data.symptomDetails?.period === "Another period (describe in notes)" &&
    !data.notes?.trim()
  )
    throw new Error("Describe the period covered in notes.");
}

export function symptomDetailText(data: Log["data"]) {
  const observation = symptomObservation(data.symptomName);
  return [
    data.symptomCount !== undefined
      ? `${observation.countLabel}: ${data.symptomCount}`
      : undefined,
    ...observation.fields.map((field) =>
      data.symptomDetails?.[field.key]
        ? `${field.label.replace(/\?$/, "")}: ${data.symptomDetails[field.key]}`
        : undefined,
    ),
  ].filter(Boolean);
}
