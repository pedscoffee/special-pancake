# Refactor notes

## Original project

KiddyMeds was an offline-first, single-file PWA for recording children's medicines, symptoms, and daily metrics. Its useful core included separate child histories, common medicine shortcuts, manually configured dose intervals, local JSON backups, and text summaries for a doctor.

The original interface was mobile-only, used prompt/alert dialogs, and regenerated markup through string interpolation. Selecting an already-selected child unexpectedly opened a rename prompt. Only the most recent medicine received a timer, the timer did not refresh automatically, temperature units were not stored with individual readings, and restoring any JSON could replace the database without validating its structure. History had no search or date filters, edits weren't exposed, and reports couldn't be previewed before copying. The service worker cached a fixed list of four files and never versioned those files by their contents.

## New structure

Next.js App Router provides actual URL-addressable views and static rendering. React handles interaction; TypeScript describes profiles and records. Components are separated from pure domain functions and browser persistence. Static export keeps the app deployable without a server, while a generated service worker precaches the actual build, including navigation payloads and every page.

The central care provider hydrates browser data after rendering, validates/migrates the original schema, writes successful changes before showing them as saved, and listens for changes in other tabs. Failed writes retain the last accepted state. Unreadable storage is protected until an explicit restore or reset. Multi-device synchronization remains outside the project's local-first scope.

## Design

The layout centers on a family overview, visible child switching, simple logging, and a timeline. Desktop has persistent navigation; phones use a compact bottom bar. Dialogs use native browser focus trapping and return focus when closed. A separate profile editor replaces implicit renaming behavior.

At the user's direction, the palette uses [Note Repertoire](https://www.noterepertoire.com/)'s actual sage tokens as its backbone:

| Role              | Color     |
| ----------------- | --------- |
| Background        | `#f4f5f1` |
| Main text         | `#1c2421` |
| Secondary text    | `#68726d` |
| Sage accent       | `#3d6348` |
| Deep sage         | `#2f5139` |
| Soft sage surface | `#e2ece3` |

The system font stack preserves the requested familiar, Apple-like feel and avoids external requests. Peach, blue, rose, and lavender remain optional small accents for care categories and child profiles. The flower illustration and icons are local SVG-based assets.

## Care-record improvements

- One clock per medicine, based on its latest recorded entry; clocks refresh while the app is open and on window focus.
- Source units stored with temperature readings, with display conversion when preferences change.
- Editable, backdated entries with consistent notes across all record types.
- A shared symptom catalog supplies 17 common observations plus a custom-entry shortcut. Each common symptom uses a distinct, simple [Lucide](https://lucide.dev/) library icon, consistently across shortcuts, recent care, and history. Symbolic icons replace the custom anatomical drawings; text labels identify the observations. Search supports everyday phrases such as "stuffy nose" and "ear pain"; category filters organize the expanded list. Existing recorded names are not rewritten. Presets include observations listed in the [American Academy of Pediatrics symptom index](https://www.healthychildren.org/English/tips-tools/symptom-checker/Pages/default.aspx), without adding diagnoses or clinical guidance.
- Bathroom check-ins separate urine and stool, with explicit observation periods, optional wet/stool diaper counts, bowel-movement counts, and original plain-language stool descriptions. Mixed diapers may appear in both observations; counts and repeated daily snapshots are never summed. Historical bathroom values remain unchanged.
- The primary daily check-in opens a single responsive form for appetite, fluids, urine, and stool. It starts without assumed answers, accepts any subset of sections, and creates independently editable records with a common time/period in one validated storage write. Desktop uses two columns; mobile stacks the sections and date/period controls. Existing per-category shortcuts remain available.
- All 17 common symptoms have optional descriptive fields. Severity remains available and starts blank. Original everyday prompts cover sound/frequency, location/side, appearance, activity, temperature method, and counted observations. Counts require a period, and another period requires notes. These are recording choices, not validated clinical scoring scales. General distinctions were checked against [AAP's cough reference](https://www.healthychildren.org/English/tips-tools/symptom-checker/IFrame/Pages/symptomviewer.aspx?symptom=Cough), [dizziness reference](https://www.healthychildren.org/English/tips-tools/symptom-checker/IFrame/Pages/symptomviewer.aspx?symptom=Dizziness), and [NIDDK's constipation descriptions](https://www.niddk.nih.gov/health-information/digestive-diseases/constipation-children/symptoms-causes). No thresholds, triage rules, or treatment recommendations are copied into the app.
- Structured symptom details are validated against the selected symptom, preserved through edits/backups/sharing, and included in search and exports. Renaming a symptom clears its unrelated fields. Care-file duplicate detection compares detail keys in a stable order. Older recorded severity and intake wording remain intact.
- Combined history search/type/date filters, pagination, and CSV export.
- Reports preview the exact included records and support text download, clipboard fallback, and print/PDF.
- Share care packages a filtered child snapshot into a readable message and an importable text file. The [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) opens device sharing options from a user click, with file support checked using [canShare](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare). Copy, email drafts, and manual download provide fallbacks; email drafts do not attach files. No action reports a message as delivered.
- Receive care validates the file, requires an explicit destination profile, skips duplicate record IDs with identical content, and reviews differing versions. A changed local record invalidates its earlier conflict choice. Merges preserve unrelated records and personal preferences, and commit only after a successful storage write. This is manual snapshot exchange, not live synchronization; deletions are not transferred.
- A transient demo keeps sample records separate from family records.
- Native dialogs replace prompts and alerts; destructive operations show a concrete review before execution.

## Deliberate limits

The stool vocabulary uses original everyday descriptions of texture. The general distinctions between hard/lumpy and loose/watery observations are consistent with [NIDDK's child constipation information](https://www.niddk.nih.gov/health-information/digestive-diseases/constipation-children/symptoms-causes) and [child diarrhea information](https://www.niddk.nih.gov/health-information/digestive-diseases/chronic-diarrhea-children/symptoms-causes). The app does not copy a numbered stool chart or classify an observation as healthy or unhealthy.

The app never calculates a dose, supplies a dosing schedule, diagnoses symptoms, or interprets an elapsed interval as proof that another dose is safe. No medical thresholds or recommendations were added. App clocks are reference information, not background notifications.

The app stores data in this browser; it does not encrypt records or synchronize devices. Original data migration can only be automatic on the same browser origin. Existing backups provide the portable migration path. Local storage is synchronous and best suited to family-scale histories; very large archives would benefit from a separate IndexedDB migration in a future version.
