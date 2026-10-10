# CHI design system — the part a developer needs

Source of truth is the CHI Design System artifact, drawn from the 2019 CHI
Brand Book. This file is a working summary. Where they disagree, the artifact wins.

## Colour

Eleven values exist in the stylesheet. That is the whole palette.

| Token | Value | Use |
|---|---|---|
| `--chi` | `#9D2235` | CHI Red. RGB 157 34 53, CMYK 0 100 63 31. On every piece. |
| `--chi-deep` | `#7A1A29` | Pressed and hover state of a red fill. |
| `--chi-soft` | `#F5E9EB` | Red at 8%, for a panel the red rule marks. |
| `--on-chi` | `#FFFFFF` | Type on a red fill. |
| `--ink` | `#303030` | Charcoal. Body and headline ink, 13:1 on white. |
| `--ink-2` | `#5C5C5C` | Secondary type. |
| `--ink-3` | `#8A8A8A` | Captions and fine print. |
| `--ground` / `--card` | `#FFFFFF` | Surface. |
| `--raise` | `#FAFAFA` | |
| `--panel` | `#F4F4F4` | Quiet panels and filled buttons. |
| `--rule` / `--rule-2` | `#DCDCDC` / `#EFEFEF` | Hairlines. |

**Other reds look close and are not CHI Red. Never substitute one.**

Red carries exactly three meanings on this page: where the participant is,
what they have to do, and when it is due. Nothing else. If you add a fourth,
all three stop reading.

The five board colours that used to exist were deliberately removed. `--s1`
through `--s5` are all charcoal now and the `-soft` variants are all `--panel`.
They are kept as tokens only so the rendering code did not have to change.

## Type

Poppins, loaded from Google Fonts, **weights 400 and 700 only**.

| Style | Size | Weight |
|---|---|---|
| display | 64px | 700 |
| headline | 36px | 700 |
| subhead | 22px | 700 |
| body | 16px | 400 |
| caption | 13px | 400 |

No 500. No 600. No second typeface — the page used IBM Plex Mono for small
labels and it was removed, because the brand book says set everything in Poppins.

## Shape

- Every `border-radius` is `0`. The brand book's own button is square.
- No drop shadows. The brand builds with rule lines, not elevation.
- **Never ALL CAPS.** No `text-transform: uppercase` anywhere.
- Light theme only. No `prefers-color-scheme` block.

## The two marks

| Asset | Where | Size |
|---|---|---|
| `assets/chi-work-and-travel.png` | Header | 27px tall, 23px under 374px, 21px under 339px |
| `assets/chi-logo.png` | Front page only | 72px, 60px on a short viewport |

Supplied by CHI. **Never redraw, recolour, stretch or rearrange either one.**
Give both clear space. The globe never goes in the header: the brand book's
half-inch floor is about 48px and its ring type is unreadable below that, and
48px crowds a 56px bar on a phone.

The supplied lockup was `#892833`. It has been recoloured to exact CHI Red
`#9D2235`, because the brand book is explicit that a near red is not CHI Red.

Both are raster. Ask CHI for SVG or EPS; the book says the logo ships in both.

## The rule line

A chi-red rule marks CHI's presence wherever a mark does not fit. It is still
used under a leaf heading, and down the left of the personal box and the
deadline box. It is no longer in the header, because the lockup is there.

## Checking yourself

```
grep -c "text-transform:uppercase" assets/styles.css     # must be 0
grep -c "prefers-color-scheme"     assets/styles.css     # must be 0
grep -oE "font-weight:[0-9]+"      assets/styles.css | sort -u   # only 400 and 700
grep -oE "border-radius:[^;}]+"    assets/styles.css | sort -u   # only 0
grep -oE "#[0-9A-Fa-f]{6}"         assets/styles.css | sort -u   # 11 values, no more
```
