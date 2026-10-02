export const SYMPTOM_GROUPS = [
  "Cold & respiratory",
  "Head & body",
  "Tummy",
  "Skin",
] as const;

export const SYMPTOM_PRESETS = [
  { name: "Fever", group: "Head & body", color: "peach" },
  { name: "Cough", group: "Cold & respiratory", color: "blue" },
  { name: "Runny nose", group: "Cold & respiratory", color: "blue" },
  { name: "Congestion", group: "Cold & respiratory", color: "mint" },
  { name: "Sore throat", group: "Cold & respiratory", color: "rose" },
  { name: "Earache", group: "Head & body", color: "peach" },
  { name: "Headache", group: "Head & body", color: "lavender" },
  { name: "Dizziness", group: "Head & body", color: "blue" },
  { name: "Pain", group: "Head & body", color: "rose" },
  { name: "Fatigue", group: "Head & body", color: "sage" },
  { name: "Stomachache", group: "Tummy", color: "peach" },
  { name: "Nausea", group: "Tummy", color: "mint" },
  { name: "Vomiting", group: "Tummy", color: "sage" },
  { name: "Diarrhea", group: "Tummy", color: "mint" },
  { name: "Constipation", group: "Tummy", color: "peach" },
  { name: "Rash", group: "Skin", color: "rose" },
  { name: "Itching", group: "Skin", color: "lavender" },
  { name: "Other symptom", group: "Other", color: "sage" },
] as const;

export const SYMPTOMS = SYMPTOM_PRESETS.map((s) => s.name);
export type SymptomName = (typeof SYMPTOM_PRESETS)[number]["name"];

// Match existing and custom records without rewriting a parent's recorded wording.
const ALIASES: Record<string, SymptomName> = {
  "ear pain": "Earache",
  "head pain": "Headache",
  "stomach pain": "Stomachache",
  "tummy ache": "Stomachache",
  "abdominal pain": "Stomachache",
  "stuffy nose": "Congestion",
  "nasal congestion": "Congestion",
  "itchy skin": "Itching",
  itch: "Itching",
  tiredness: "Fatigue",
  tired: "Fatigue",
  dizzy: "Dizziness",
};

export function symptomPreset(name = "") {
  const normalized = name.trim().toLocaleLowerCase();
  const alias = ALIASES[normalized];
  return SYMPTOM_PRESETS.find(
    (s) => s.name.toLocaleLowerCase() === normalized || s.name === alias,
  );
}

export function filterSymptoms(search: string, group = "All") {
  const query = search.trim().toLocaleLowerCase();
  return SYMPTOM_PRESETS.filter(
    (s) =>
      (group === "All" || s.group === group) &&
      (!query ||
        s.name.toLocaleLowerCase().includes(query) ||
        Object.entries(ALIASES).some(
          ([alias, name]) => name === s.name && alias.includes(query),
        )),
  );
}
