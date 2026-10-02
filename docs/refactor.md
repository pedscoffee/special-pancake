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
- Bathroom counts are actual numeric observations rather than an unimplemented placeholder.
- Combined history search/type/date filters, pagination, and CSV export.
- Reports preview the exact included records and support text download, clipboard fallback, and print/PDF.
- A transient demo keeps sample records separate from family records.
- Native dialogs replace prompts and alerts; destructive operations show a concrete review before execution.

## Deliberate limits

The app never calculates a dose, supplies a dosing schedule, diagnoses symptoms, or interprets an elapsed interval as proof that another dose is safe. No medical thresholds or recommendations were added. App clocks are reference information, not background notifications.

The app stores data in this browser; it does not encrypt records or synchronize devices. Original data migration can only be automatic on the same browser origin. Existing backups provide the portable migration path. Local storage is synchronous and best suited to family-scale histories; very large archives would benefit from a separate IndexedDB migration in a future version.
