import { test } from "node:test";
import assert from "node:assert/strict";
import { filterSymptoms, symptomPreset } from "../lib/symptoms";

test("symptom search handles everyday synonyms, case, whitespace and category intersections", () => {
  assert.deepEqual(
    filterSymptoms(" Stuffy ").map((s) => s.name),
    ["Congestion"],
  );
  assert.deepEqual(
    filterSymptoms("ITCHY", "Skin").map((s) => s.name),
    ["Itching"],
  );
  assert.deepEqual(filterSymptoms("itchy", "Tummy"), []);
  assert.deepEqual(
    filterSymptoms("ear pain").map((s) => s.name),
    ["Earache"],
  );
  assert.deepEqual(
    filterSymptoms("", "Skin").map((s) => s.name),
    ["Rash", "Itching"],
  );
  assert.equal(symptomPreset(" FEVER ")?.name, "Fever");
  assert.equal(symptomPreset("stomach pain")?.name, "Stomachache");
  assert.equal(symptomPreset("My own observation"), undefined);
  assert.deepEqual(filterSymptoms("My own observation"), []);
});
