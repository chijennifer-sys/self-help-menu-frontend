# CHI Participant Help Menu — frontend

The self-service menu for CHI Work and Travel participants. Static HTML,
served by GitHub Pages from this repository,
`chijennifer-sys/self-help-menu-frontend`.

**Public repo. No ids, no secrets, no participant data.**

Once GitHub Pages is turned on, the menu is at
<https://chijennifer-sys.github.io/self-help-menu-frontend/>.

The Google script and the roster live in the other repository,
`chijennifer-sys/self-help-menu-backend`. The only backend address that
belongs in this repo is the public `/exec` URL, in `assets/config.js`.

Hand setup for a non-developer is in [`docs/instructions.md`](docs/instructions.md).

## Running it

Open `index.html`. With `ENDPOINT` empty in `assets/config.js` it runs on a
five-person demo roster and shows a preview strip. That is the whole dev loop.

## Files

| | |
|---|---|
| `index.html` | Shell: header, search, the view container, the bottom bar. |
| `assets/styles.css` | The CHI design system, applied. See `DESIGN-SYSTEM.md`. |
| `assets/content.js` | 5 stages, 67 tiles, 66 icons, agency names, CHI contacts. **This is the file a coordinator edits.** No logic, no secrets. |
| `assets/config.js` | `ENDPOINT` and the demo roster. |
| `assets/app.js` | Dates, identification, rendering, events. |

Keep that line. Tile wording does not go in `app.js`; logic does not go in
`content.js`.

## Changing an answer

Find the tile in `assets/content.js` and edit `lead`, `body`, `need` or `you`.
Push. Pages redeploys in about a minute.

Keep the participant voice: short sentences, one idea each, numbered
sequences, jargon defined every time, no idiom. Measured reading level is
grade 2.9 and it should stay there. House terms: **tax overages**, never "tax
refund"; **fingerprinting**, never "casino licence".

## What must never be committed here

A Sheet id, a Drive folder id, a Script id, a deployment id, a `.clasprc.json`,
a participant name or a real Student ID. The Pages workflow fails the build if
it finds one. Do not weaken that check.

The `/exec` URL in `config.js` is the one backend reference that belongs here.
It is public by necessity, which is why the backend authenticates every call.
