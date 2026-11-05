---
name: MN-Qronx
description: "Phòng mini-hompy — the landing is your own furnished room; a due task lights up and the bell beside it rings."
colors:
  porcelain: "#FFF6EC"
  ink: "#4A3B2C"
  acorn: "#8B6F4E"
  oat: "#EADCC7"
  moss: "#DCE8DF"
  sage: "#A9C4B1"
  rain: "#B7C7D6"
  blush: "#F5C9CF"
  bell: "#E2B05C"
  sky: "#B9CADA"
typography:
  display:
    fontFamily: "'Baloo 2', 'Nunito', sans-serif"
    fontSize: "2.15rem"
    fontWeight: 400
    lineHeight: "1.08"
  headline:
    fontFamily: "'Baloo 2', 'Nunito', sans-serif"
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: "1.25"
  title:
    fontFamily: "'Baloo 2', 'Nunito', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: "1.25"
  body:
    fontFamily: "'Nunito', 'Plus Jakarta Sans', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "1.625"
  label:
    fontFamily: "'Nunito', 'Plus Jakarta Sans', sans-serif"
    fontSize: "11px"
    fontWeight: 900
    lineHeight: "1.35"
    letterSpacing: "0.1em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  sheet: "1.8rem"
  shell: "2.2rem"
  pill: "999px"
spacing:
  sm: "10px"
  md: "16px"
  lg: "20px"
  section: "40px"
  section-lg: "80px"
components:
  button-primary:
    backgroundColor: "{colors.acorn}"
    textColor: "{colors.porcelain}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.acorn}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  chip-demo:
    backgroundColor: "{colors.blush}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  card-rail:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-drawer:
    backgroundColor: "{colors.moss}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  nav-bar:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 8px 8px 12px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  input-room:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 14px"
  panel-error:
    backgroundColor: "{colors.rain}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "14px"
  panel-success:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  card-tape:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px 20px 20px"
---

# Design System: MN-Qronx — Phòng mini-hompy

## Overview

**Creative North Star: "The Furnished On-Time Room" (Phòng mini-hompy)**

MN-Qronx's landing world refuses the default SaaS page — no gradient hero, no three equal feature cards, no cascading color words. Instead the homepage is **your own room**: a Porcelain-paper ground drawn in warm Acorn strokes, isometric furniture walls (moss, sage, oat) and a checkered floor. Every task is an object you place in the room; a due task is the object that lights up while the desk bell beside it swings and rings. Proof, not paint: the wall clock shows real time, "today" is the real date, and every fabricated number wears a Blush **MẪU/DEMO** chip.

The build is the incumbent authority for this world (landed in `src/pages/guest/LandingPage.jsx` + `RoomScene`/`RailCards`, tokenized in `src/index.css` → `tailwind.config.js` as the `room.*` scale bound to `--room-*` CSS variables with `<alpha-value>`). The room is scoped by the `.room-world` wrapper — walking into it swaps font family, selection color, focus ring, and scrollbar to the warm system; an older navy app shell still exists elsewhere in the codebase and its tokens (`navy`, `brand`, `--alarm-bg`, glow/beam effects) are forbidden inside room surfaces. Both themes are first-class: light is a sunny paper room, dark is the same room at evening with a warm lamp — never blue-black.

Milestone 2 extends the world into the guest auth gate (`AuthLayout` + the RoomUI form skin — Login, Register, Forgot/Reset Password, the Google callback) and nothing bends: fields are 44px paper tiles with a hairline Acorn ring, the halved screen is still one continuous sheet of Porcelain split only by a dotted cord, and errors stay weather-cool — the world survives forms without growing a new voice.

**Key Characteristics:**
- Porcelain paper ground; every seam, stroke, and action is drawn with a warm Acorn pen.
- Blush is a state color, not decoration: it marks only the due moment (lit task, its glow, MẪU chips).
- Dark mode is a warm evening room (#2B231E paper) lit by a diegetic lamp glow.
- Sections breathe on dotted seams (`.dot-divider`); cards are flat paper with hairline Acorn rings.
- Forms wear the landing's skin (`RoomUI`): every text-entry hit-area is 44px tall and errors publish as bold Ink text, never a new red.
- Faults are neutral weather: invalid fields and error panels are Rain — no rose, no red; the due state keeps its color-alarm monopoly.
- Baloo 2 (display) + Nunito (body), self-hosted variable fonts with preloads.
- Furnishings are flat sticker-props on an isometric floor; the room scene is the world's one authored illustration.
- One authored motion: the demo bell circuit (task lights → bell swings → "(mẫu)" toast). Everything else is quiet reveals and ≤2px hover lifts.
- Product truth is a design rule: real clock, real date, labeled demo numbers, unchanged routes (`/ /app /login /register /pricing`, anchors `#tinh-nang #cach-hoat-dong #gioi-thieu #lien-he`).

## Colors

A warm paper-and-ink room: brown ink text on Porcelain paper, with one working pen (Acorn) filling in structure across soft furniture fields; two reserved voice colors hold meaning — gold rings sound, pink lights up when something is due.

### Primary
- **Acorn** (#8B6F4E — dark: rgb(199 168 133)): the pen and the hand. All outlines, hairline rings, dotted seams, primary CTAs, the desk pen details, clock hands, and the dashed focus ring are Acorn. It is the world's working accent on both themes — as `rgb(var(--room-acorn))` everywhere.
- **Ink** (#4A3B2C — dark: rgb(233 222 208)): all reading text, from headings to card body, always paired against Porcelain-family grounds. As solid fills it parks toasts (Ink pill, Porcelain text), and any text sitting on Blush must be Ink (`#4A3B2C` via `.on-blush`, theme-independent).

### Secondary
- **Bell gold** (#E2B05C — dark: rgb(232 191 118)): reserved for sounding and burning things — the desk bell, the sun, flower centers, the lamp bulb. Never used as a large field and never on body copy.

### Tertiary (state color)
- **Blush** (#F5C9CF — dark: rgb(243 183 190)): the due/đến-hạn light of the world. On app surfaces it appears only as the due state: the lit task item, its pulsing glow, and the MẪU/DEMO chips. Inside the authored room scene it may additionally dress soft fabric (garland flags, the armchair pillow) — that latitude stops at the SVG scene.

### Neutral (room surfaces)
- **Porcelain** (#FFF6EC — dark: rgb(43 35 30)): the paper ground and paper fills; in dark values it becomes the warm evening room `#2B231E`.
- **Oat** (#EADCC7 — dark: rgb(62 52 43)): the floor, tabletops, and cream fields.
- **Moss** (#DCE8DF — dark: rgb(55 69 58)) and **Sage** (#A9C4B1 — dark: rgb(97 124 104)): the two structural wallpaper/furniture walls and cool green furniture fields. On app chrome: Moss/70 anchors the dev-code reminder note and the 24–32px icon tiles (blips, tape cards), Sage/45 is the success-panel climate on forms.
- **Rain** (#B7C7D6 — dark: rgb(116 132 148)): the neutral cool field — round rug, pending-dot, unused-task markers; on forms it is the error climate: the invalid field's ring and the error panel at 30%, always under Acorn rings with Ink copy (The Rain-Is-Neutral Rule).
- **Sky** (#B9CADA — dark: rgb(40 50 68)): the arched-window pane that day turns into night glass.

### Named Rules
**The Acorn-Pen Rule.** One pen draws the world. Strokes, rings, seams, dividers, focus outlines, and scrollbars are all `rgb(var(--room-acorn))` at varying alpha (0.15–0.9); furniture fields (Oat/Moss/Sage/Rain/Sky) are fills only and never draw outlines.

**The Due-Only Blush Rule.** Blush earns its space by meaning: on UI surfaces it marks the due state exclusively — the lit task, its breathing glow, and honest-demo MẪU chips. If a Blush element doesn't tell you something is due, it doesn't belong on app chrome.

**The Rain-Is-Neutral Rule.** Rain handles error, pending and waiting as neutral weather: an invalid field rings Rain (rest, hover and focus alike), a server error sits on Rain/30 with a bold Ink sentence and a `WarningCircle` — no rose, no red, never a red field. Color alarm stays the exclusive property of the due state (Blush).

**The Warm-Night Rule.** Dark mode is the same room at night: Porcelain turns to warm #2B231E, and the lamp — one diegetic `#EECB8A` constant drawn through the dark-only `.lamp-glow` veil (wrapper opacity 0 → 0.55, 0.6s fade): the scene's bulb washes 0.85 → 0.30, the auth wall's wash 0.5 → 0.15 at 55% radius. Never regrade this world onto navy, slate, or blue-black grounds — and never show the lamp in light mode.

## Typography

**Display Font:** Baloo 2 (variable 400–800, self-hosted `/fonts/Baloo2-Variable.ttf`, `font-display: swap`, preloaded) with Nunito fallback — mapped as Tailwind `font-display`.
**Body Font:** Nunito (variable 200–1000 + italic, self-hosted, preloaded) with Plus Jakarta Sans system fallback — Tailwind `font-body`, enforced inside `.room-world`.
**Label Font:** none distinct — labels are Nunito at weight 900 with tracking.

**Character:** A chunky, hand-drawn display face that dictates warmth over a soft, round, legible body face. Baloo 2 stays round and heavy even at its regular weight, so headings may sit at 400; component titles carry 700; nothing is uppercase-only and nothing tracks tight.

### Hierarchy
- **Display** (400, 2.15rem → 2.35rem at sm+, leading 1.08): the single hero headline, `font-display`, break-separated with an Acorn second line.
- **Headline** (400, 1.875rem → 2.25rem sm+, leading tight): section headings (Tính năng, Cách hoạt động, Giới thiệu), `font-display`, two lines with the Acorn second segment.
- **Banner callout** (700, up to 2.6rem): the closing CTA "Plan. Do. On Time." uses the same display face bolded.
- **Title** (700, 15px, leading tight): card and drawer titles (`font-display` bold); rail names, clock/date lines, drawer numbers.
- **Body** (400–600, 15px at hero/sections, 13px in cards, leading-relaxed 1.625): descriptive copy, max-width ~28rem (`max-w-md`) for hero prose; `text-balance` on display titles, `text-pretty` on body.
- **Label** (900, 11px, tracking 0.1em, rounded pills): the chip vocabulary — `MẪU/DEMO` chips, theme/lang toggles, in-world letter press plates (the drawer nameplate at 0.16em and footer slogan plate at 0.18em are the two shipped furniture artifacts of this pattern).
- **Field copy** (13px bold labels with an Acorn `*`; 12px bold errors vs 12px semibold hints; 14px input text): the auth gate's form scale — one Nunito family throughout, emphasis earned by weight, never by recoloring text red.
- **Data figure** (700, 30px `font-display`): the rail's demo counter "1.284".

### Named Rules
**The Round-Heavy Rule.** Baloo 2 carries identity even resting at 400 — never letter-space-tighten it, never set headings in uppercase, and never substitute a system display face; Nunito alone carries reading copy.

**The Solid-Wordmark Rule.** In room surfaces the logotype is plain token lettering — `WorldLogo`: Baloo 2 700, `MN-` Ink / `Q` Acorn / `ronx` Ink, solid color, no gradient and no glow; the gradient logotype stays quarantined in the old shell's `Logo.jsx` and never enters room surfaces.

## Layout

The world is composed for one protagonist per act. The first viewport is a three-column stage on `max-w-[1300px]`: left copy column (`1.02fr` — headline, sub-line, two CTAs, desktop link, three icon blips), center protagonist (`1.42fr` — the isometric RoomScene with the floating task card overlapping its base), right rail (`0.76fr` — three taped cards). On mobile the room leads (`order-1`), copy follows, the rail stacks last; the rail column only appears beside the room at `lg` (1024px; Tailwind's sm 640 / md 768 / xl 1280 are the other breakpoints).

Below the fold, content sections sit on `max-w-6xl` (72rem) with a centered reading column (`max-w-2xl`, How It Works; `max-w-5xl`, hole-punched anchor). Vertical rhythm is generous: `py-16` (4rem) per section, growing to `lg:py-20` (5rem), separated by `.dot-divider` seams at `my-2` capped `max-w-5xl`. The footer is a full-bleed Oat slab with a rounded top (`rounded-t-[2.4rem]`). Density is airy: 10–16px inner gaps in cards, 12–14px grid gutters between drawers.

The auth gate (Login, Register, Forgot/Reset Password, Google callback) is the doorway frame: one continuous `min-h-dvh` `.room-world` ground — wall and form are the same sheet of Porcelain; the only division is drawn, a 3px dotted cord down the wall's edge. From `lg` (1024px) a 46%-width wall carries the WorldLogo (32px) top-left, `p-12`/`p-16` at `xl` (48/64px pad), the 2.15rem two-line Baloo 2 greeting with the Acorn second line ("Phòng của bạn, / đã dọn sẵn."), a 15px Ink/80 sub-paragraph, the single taped card and three 24px Moss blips, with the 12px Ink/50 ©-footer left resting on the wall; the right side is the form sheet — `max-w-md` centered (`px-4`/`px-8`, `py-10`), `h1` 1.95rem → 2.15rem at `sm+`, subtitle 15px Ink/75, form starting at `mt-7`. Below `lg` the wall folds away and the paper stands alone: a 30px logo above the headline, then the form.

### Named Rules
**The Dotted Seam Rule.** Page sections part on the dotted seam — `dot-divider` (3px strip of spaced Acorn dots, 16px rhythm), echoed by peer dotted rules (list leaders, dotted underlines, dashed frames). Solid hairlines stay inside a single footer; they never replace the page's dotted doctrine.

**The Host Rule.** Every viewport names its host — the room in the hero, the cabinet in features, the clothesline in how-it-works — and all surrounding copy serves it. No equal-card wall outside the one waived cabinet shell (see Do's and Don'ts).

**The Doorway Rule.** The auth gate is one room, not a second shell: no card-on-canvas, no glass — the split screen is drawn only by the vertical dotted cord (`w-[3px]`, the same 1.6px dots in a 3×16px column at Acorn/50, wrapper at 80% opacity). Below `lg` there is no door at all: the form sits alone on the paper under a 30px logo.

## Elevation & Depth

Depth is tonal and hand-set, not modeled. Surfaces sit flat on paper with a 1px warm hairline ring (`ring-room-acorn/20–35`, scene strokes 2–2.5px); dimension is drawn — the isometric floor, desk thickness, wooden pins, tape strips — rather than cast by light. What few shadows exist are small, diffuse, black-and-neutral paper weights at large negative offsets, reserved strictly for raised actions and floating paper:

### Shadow Vocabulary
- **Raised-action weight** (`0 14px 26px -12px rgb(0 0 0 / 0.30)`; nav-scope `0 8px 18px -8px / 0.30`): under primary Acorn pills and the floating nav bar.
- **Floating-card weight** (`0 14px 30px -18px rgb(0 0 0 / 0.25)`): under the taped task card; `0 12px 28px -18px / 0.35` under the pill nav; tiny `0 3px 6px / 0.28` under wooden pins.
- **Focus-response weight** (`0 0 0 4px rgb(var(--room-acorn) / 0.12)` under the field's inset ring deepening to 2px Acorn; the field lifts −1px): the halo a touched field earns while focused — a state weight that never exists at rest.
- **Diegetic light (not shadow)**: the Blush due-glow (`radial`, breathing `room-due-glow` 2.6s) around the lit task, and the dark-only warm lamp `#EECB8A` (scene bulb 0.85 → 0.30, auth wall wash 0.5 → 0.15 through the 0.55 veil) — these are room light, the only things allowed to glow.

### Named Rules
**The Paper-Weight Rule.** Surfaces are flat paper at rest; soft black diffuse shadows belong only under raised pills and floating taped cards (a touched field may flash the one focus halo — a response, not a resting shadow) — never colored, never drop-shadowed into "3D card" territory, and the only breathing glow is diegetic room light (Blush due-glow, night lamp).

## Shapes

Form language is paper-and-furniture roundness. Interactive chrome is pill-shaped (`rounded-full`, 999px): nav bar, CTAs, chips, toggles, toasts. Content surfaces are 16px cards (`rounded-2xl`) with 8–12px inner icon tiles (`rounded-lg`/`xl`). Larger furniture blocks — the features cabinet, the closing plinth, the footer slab — use oversized shells (`rounded-[1.8rem]`–`[2.4rem]`, ~29–38px) so they read as cut paper furniture, always framed by a thin Acorn ring instead of a heavy border.

Silhouettes are hand-dressed: rail cards carry small angled tape strips on their top edge (tape: Oat paper at 90%, 48–56px × 12px, 3px-rounded, rotated −3°…−5°, ringed Acorn/20, straddling the edge by 8–10px); How-It-Works cards pin to a sagging clothesline and tilt by ±0.9–1.1deg alternately; the floating task card leans −2deg. The dashed accent is a texture: an inner dashed Acorn frame on the closing CTA, dotted underlines on text links. The room scene itself renders the geometry (isometric walls + checkered floor, arched window, upright sticker props, dashed round-rug trim) — flat vector fills and Acorn line work, no paint gradients except the two radial light definitions (Blush due-glow, warm lamp).

### Signature Components
- **RoomScene** (`src/components/landing/RoomScene.jsx`) — the world's host object: authored isometric room from 100+ flat primitives, real-time wall clock, the blush-lit due task with pulse glow, and the desk bell that swings (`animate-alarm-bell`, ±12°, 0.9s) and triggers the "(mẫu)" toast (`animate-pop-in`) when the visitor presses "Đặt báo thức". State machine: idle → lit (0.5s) → ring → idle (2.7s).
- **RailCards** — the taped-card rail: real date card; demo counter; on-time journal with status dots (Sage done / Rain pending).
- **Dot devices**: the horizontal section seam (`dot-divider`: 1.6px Acorn dots / 16px rhythm, α 0.5) and the two siblings shipped by the auth build — the `RoomDots` leader that wraps the "Hoặc" divider (full-width flex line, α 0.65) and the vertical wall cord (the same dots turned into a 3×16px column, `repeat-y`) — all one dotted grammar at three orientations.
- **Dot seams' furniture set**: tape strips, drawer-knob tiles, wooden pins and the Moss icon-tile (rounded-lg/xl, 24–32px, holding a 13–18px single-stroke icon) — recurring micro-furniture of the world.
- **Room form skin** (`src/components/common/RoomUI.jsx`) — `RoomField` / `RoomInput` / `RoomButton` / `RoomDots`: the only skin a guest form should wear (spec below in Components); also home of the OAuth callback's idle door — centered WorldLogo (44px), a 40px Acorn-only spinner (`border-room-acorn border-t-transparent`, `animate-spin`) and a 14px Ink/70 line.

## Components

### Buttons
- **Shape:** full pills; primary and secondary share typography `{typography.title}` (Baloo 2, 700, 15px) and icon-leading layout (`CaretRight` caret, `BellRinging`/`House` 15px).
- **Primary:** Acorn field, Porcelain text (`px-6 py-3`, 12px/24px), soft paper weight beneath.
- **Hover / Disabled:** hover lifts 2px (`-translate-y-0.5`) with slight Acorn deepening — `bg-room-acorn/95` on the landing pill, the room-skin equivalent `brightness-[0.96]` on a `RoomButton`; active presses back down (`translate-y-0 scale-[0.99]`). Disabled: opacity 60 with the shadow switched off; the demo button disables at 70% opacity mid-circuit. Dashed Acorn outline (`:focus-visible`, `.room-world :focus-visible`) is the shared focus state of the world — pills cross it with a ring-2 Acorn at transparent offset.
- **Secondary / Ghost:** paper field, ring-1 Acorn/40, Ink text; hover fills Oat at 60%. Text links are bold Ink that hovers to Acorn; links under the form underline with a dotted Acorn rule (dotted, offset 4px).
- **Room pill sizes:** the `RoomButton` ramp sizes `sm h-9 px-3.5` (36px, 13px) / `md h-10 px-5` (40px, 14px) / `lg h-12 px-6` (48px, 15px) — all `font-display` bold, full pills, 16px/18px icons at `bold` weight; loading swaps the label for a small spinner + "Đang xử lý…" and self-disables. Main actions run `lg`.

### Chips
- **MẪU/DEMO chip (`chip-demo`):** Blush field, `.on-blush` Ink text (`#4A3B2C`), 11px weight 900, tracking 0.1em, `px-2 py-0.5` — attaches to every fabricated number and to the demo task card.
- **Nameplate pill:** Moss field, Acorn ring, Ink 900 caps text with tracking — the furniture variant (drawer nameplate, footer letterpress, "real time" caption on the scene).

### Cards / Containers
- **Corner Style:** 16px; oversized shells 1.8rem–2.4rem for furniture blocks.
- **Background:** rail cards Porcelain/80; drawers Moss/55; plinth Moss/80; cabinet Oat/70 with Porcelain/75 inner sheet.
- **Border:** ring-1 Acorn at 20–35%; no heavy borders, in dark mode the same rings warm up automatically through the variables.
- **Shadow Strategy:** Paper-Weight Rule (see Elevation).
- **Internal Padding:** rails 16px; drawers 20px; plinths 40–56px.

### Inputs / Fields
- **Style:** a 44px (`h-11`) paper tile, `rounded-xl` (12px), inset `ring-1` at Acorn/25; input text 14px Ink, placeholder Ink/30. A leading 18px icon (Phosphor line style) hangs at Ink/35 and reserves `pl-10` (40px) on the left edge.
- **State ramp (room field):** rest ring Acorn/25 → hover ring Acorn/45 → focus: the ring deepens to 2px inset Acorn, the tile lifts 1px and flashes the focus halo (`0 0 0 4px` Acorn/0.12) → invalid: the ring turns Rain and *stays* Rain through hover and focus (the Acorn ring returns the moment the fix lands) → disabled: the field fills Oat/40, text drops to Ink/40, cursor not-allowed. Keyboard focus on everything else keeps the world's dashed Acorn `:focus-visible` outline.
- **Field furniture (`RoomField`):** 13px bold Ink label with the required `*` in Acorn; the error line is a `role="alert"` paragraph — 12px bold Ink; the hint sits at 12px semibold Ink/60. Errors are bold text, not colored text, so form copy reads the same at rest and at fault.
- **Hit areas:** the password eye toggle is a full 44px round hit zone (`h-11 w-11`, 18px icon at Ink/45, hover Acorn); remember-me rows and forgot-password links ride `min-h-11`. The 44px entry/toggle floor is the world's touch rule — main action pills exceed it at `h-12`.

### Panels (form status)
- **Error / alert (`bg-room-rain/30`):** a 16px-rounded tile, `p-3.5`, `ring-1` Acorn/25, a bold `WarningCircle` (18px, Ink) leading one bold 14px Ink sentence, published as `role="alert"`. Told as weather, not a siren: cool neutral Rain, no rose, no red.
- **Success (`bg-room-sage/45`):** same Acorn hairline, `p-5`, a bold `CheckCircle` (22px) in Acorn leading bold Ink copy; the next step (a link or primary pill) sits *below* the panel, never inside it.
- **Dev-code reminder (`bg-room-moss/70`):** the honest fallback note — a `Lightbulb` 16px in Acorn (never an emoji), 13px semibold Ink with the 6-digit code bold and `tracking-widest`.
- All three share one ring grammar (Acorn/25) so no state ever resembles another app's alert.

### Navigation
- Floating pill bar `nav-bar`: Porcelain/95, ring Acorn/30, raised-action weight; brand wordmark left (Baloo 2, "MN-" Ink / "Q" Acorn / "ronx" Ink), hidden-`lg` anchor links as hover-friendly pills (hover Oat/60, Ink/75 → Ink), round Moss action tiles (theme/lang toggles, 36px), quiet Ink text login, primary mini pill nested last. Anchors + routes exactly as shipped; mobile relies on anchors and the footer.

### Signature toast
- **Toast ("(mẫu)" confirmation):** Ink pill over the room scene (`bg-room-ink`, Porcelain text, 12px bold), pops in (`animate-pop-in`), lives only while the bell rings — proof the demo is a demo.

## Shell & Dashboard (mốc M2)

App shell và dashboard là **Operate**: thế giới phòng chỉ mượn chữ, màu token, mật độ thẻ giấy và đúng một signature — nav và controls vẫn đọc như web chuẩn, không thành artifact của thế giới.

- **Khung (`.room-world` phủ toàn `/app`):** Sidebar 256px `sticky h-dvh` (logo 64px + menu cuộn trong khối riêng + thẻ "Plan. Do. On Time." ghim đáy), Header 64px (tìm nhanh, chuông demo, theme/lang, avatar + PLAN_BADGE da phòng chỉ đè màu tại chỗ dùng), BottomNav 4 mục + FAB giữa cho mobile. Nền Porcelain, panel `rounded-2xl` + `ring-1 ring-room-acorn/25` + paper weight; không gradient, không glass.
- **Phòng của bạn (đầu dashboard):** landing hứa "vào phòng" nên `/app` mở bằng **chính cảnh phòng isometric của landing** (`RoomScene` với prop `app`): cửa sổ đổi mặt trời/trăng theo theme, đồng hồ chạy giờ thật, kệ + bàn học + cây, khung cắt `viewBox 0 150 640 440` và `max-w-[560px]` để phòng không chiếm hết màn hình làm việc; bỏ nút demo chuông và thẻ "(mẫu)" của landing. Dưới cảnh là **bệ bàn** `bg-room-acorn/45` mang bảng tên thật ("Phòng của <tên>") và hai số thật của hôm nay (việc hôm nay, quá hạn) — không lặp lại số nào đã có trong tủ.
- **Hai cánh (xl+):** bàn trái ~2/3 (chào 1 dòng → rail quá hạn → Phòng của bạn → "Hôm nay" → banner gói hạn khi ≤7 ngày → "Lịch trình hôm nay"), tủ phải ~1/3 (sticker streak → tổng quan 2×2 → "Thống kê nhanh" → hàng Trợ lý AI → note Moss → thẻ nhận thưởng). Dưới `xl` xếp một cột theo đúng thứ tự đọc đó — rail quá hạn vẫn là khối đầu tiên sau chào ở mọi viewport. Thẻ "Nhận thưởng mới mỗi ngày" cuối tủ là khối chức năng gốc của dashboard cũ (không phải khối tủ thứ bảy) — giữ nguyên logic, da phòng hoá.
- **Signature duy nhất:** sticker dán tape "Phần thưởng đăng nhập" trên mặt tủ — tape Oat/90 xoay −5°, số streak Baloo 2, `Flame` một nét, CTA paper pill. Không thêm sticker thứ hai ở bất kỳ màn app nào.
- **Vòng % gọn:** `ProgressRing` 128px nét Acorn thuần (giữ SVG/`stroke-dasharray` cũ) và chú giải 4 dòng **đứng cạnh nhau** từ `sm:`; tủ phải vốn dài hơn bàn trái, xếp dọc làm cột trái trống thêm ~110px.
- **Nav pill định vị:** `top/left/width/height` đo bằng `getBoundingClientRect` so với `nav` + `scrollTop`, đo lại qua `ResizeObserver` + `MutationObserver` + `document.fonts.ready` (WorkspaceSwitcher nạp không gian bất đồng bộ). Trong phòng pill **định vị lại ngay, không trượt** — `.room-world .nav-pill` chỉ còn transition `opacity 0.3s` (sàn ONE authored motion; trượt `top 0.5s` của shell cũ sinh khung giữa chuyến khi capture/reflow). Phép đo có **zero-guard**: Chrome sập bề mặt khi capture/chuyển tab làm mọi rect về 0 — bỏ qua, không commit vẽ về `(0,0)`; đây là gốc của ghost pill trong fullPage của bản chụp trước (Sidebar + BottomNav cùng cơ chế).
- **Rail quá hạn:** tile `bg-room-rain/30` + `WarningCircle` + số việc + link — Rain trung tính, không rose, không đỏ gấp gáp; hàng việc quá hạn trong danh sách mới là chỗ duy nhất dùng Blush (`blush/40`) và `room-due-glow` 2.6s trên chấm trạng thái của hàng đến hạn đầu tiên.
- **Rãnh nút nổi:** cụm 3 nút `fixed right-4` (phím tắt / tạo nhanh / tập trung) là chrome chuẩn của shell; `main` chừa `lg:pr-20` để mép thẻ cánh tủ không bị cụm nút đè lên.
- **Hàng quá hạn ở dark:** Blush 45% trên nền tối thành hồng nhạt và chữ Ink sáng chỉ còn ~3:1, nên hàng dùng `dark:bg-room-blush/30` (`hover:/40`) và nhãn "Quá hạn" đổi sang `dark:text-room-blush`; `.on-blush` (#4a3b2c) chỉ dành cho nền Blush đặc, không dùng trên hàng đã pha loãng ở dark.
- **Cỡ chữ ngoài ramp & màu fallback (advisory — 20 findings, toàn advisory, không chặn ship):** nhãn phụ trong shell dùng literal `10px` (chip Pro, PLAN_BADGE, nhãn ngôn ngữ, nhãn BottomNav/WorkspaceSwitcher/SupportBadge), `12px`/`12.5px` (chú thích ngày, mô tả note) và `13px` (nút paper pill, dòng phụ dưới chào); số streak trên sticker dùng `2rem` Baloo. Đó là các bước phụ của mốc này cho nhãn phụ / số dữ liệu, không dùng cho tiêu đề hay số lớn khác (giữ `text-2xl` Baloo); màu `#7c8cff` duy nhất trong `TodayBrief` (dot màu tiết học) là fallback giữ nguyên từ bản gốc — chưa mở cửa vào bảng token phòng.

### Raster provenance

Ảnh duyệt mốc shell + dashboard, chụp từ dev local (Vite dev + API `:8081`, tài khoản demo; theme gắn tại `document_start` để fullPage không sinh tile stale tối/l sáng lẫn lộn):

| File (`.impeccable/review/`) | Viewport | Nội dung |
| --- | --- | --- |
| `desktop.png` | 1440×900, sáng | `/app` first viewport, đủ header + hai cánh |
| `desktop-full.png` | 1440×2300+, sáng | toàn trang (rail đầu bàn → phòng → lịch → tủ đủ hàng) |
| `desktop-dark.png` | 1440×900, tối | first viewport chế độ đêm |
| `mobile.png` | 390×844, sáng | toàn trang, BottomNav + FAB |
| `mobile-dark.png` | 390×844, tối | first viewport chế độ đêm |
| `landing-check.png` | 1440×1000, sáng | landing sau khi thêm prop `app` — cảnh phòng + thẻ demo "(mẫu)" + nhãn "giờ thật" vẫn còn |

Dữ liệu trong ảnh (chụp 5/11) là dữ liệu thật của tài khoản demo qua API local: 1 việc hôm nay (08:00 đã trôi), 4 quá hạn tự trôi qua đêm theo đúng logic backend, 1 đã hoàn thành, streak 2, 20 điểm, vòng 17% — không có số bịa nào được đóng cứng trong build.

Kết thúc mốc: reviewer fresh chấm **SHIP** (trên 5 raster cùng bảng trên). Hai vòng fix trước đó: round 1 — toast key, rail Oat→`Rain/30`, ExtensionPromoBar & UpdateNotification về da phòng (bỏ emoji/gradient/kicker/stagger), lỗi `isActive` trong MobileDrawer, WorldLogo `whitespace-nowrap`, Sidebar measure thêm MutationObserver + `document.fonts.ready`; round 2 — zero-guard cho pill (Sidebar + BottomNav) và gỡ trượt pill trong `.room-world`.

## Bàn học thành phím + trang Công việc (mốc M3)

Đúng luật M2: đây vẫn là **Operate** — logic/API/chuỗi không đụng, chỉ da đổi về token phòng.

- **Bàn học tương tác:** `RoomScene` nhận thêm `cards` (tối đa 2 món `{id, title, tone}` — ô trái nhặt việc quá hạn đầu, ô giữa nhặt việc hạn hôm nay, thiếu việc hôm nay mới bơm quá hạn thứ hai), `completedCount` và `onTaskClick`. Món thật → `<g role="button" tabindex="0">` với `aria-label "Mở chi tiết công việc: …"` + tooltip `<title>`; bấm/Enter/Space mở đúng trang chi tiết việc. Landing không truyền props nên cảnh tĩnh giữ nguyên 100%. Trạng thái slot trung thực: có việc quá hạn = thẻ Blush + quầng `room-due-glow`; việc hôm nay = thẻ Paper; **ô trống = nét đứt Acorn/45** (không dựng thẻ giả); `completedCount ≤ 0` thì sticker dấu tích cũng biến thành nét đứt — không vẽ điều không có. Hover nhỉnh −2.5px + viền đậm nét (ramp trạng thái, không phải authored motion mới).
- **Trang Công việc (list/chi tiết/form):** toàn bộ navy token đổi thành giấy phòng — `page-title`/`card` → room Ink + `RoomCard` (ring Acorn/25); selects trên khay Oat/45, mũi tên hằn Acorn; thanh tìm kiếm/lọc/sắp xếp giữ đúng bộ options cũ. TaskItem bật `skin="room"` (đã có sẵn từ M2). Thùng rác toàn trang dùng **Rain trung tính** (badge đếm, viền mở) — không rose. Xác nhận hủy/xóa → `ConfirmDialog skin="room"` + **pill Rain** (RoomButton `danger` — thế giới không có màu đỏ, Rain nói "chờ dẹp"). Nút hoàn thành chính = Acorn pill; mở lại = secondary.
- **Chỉ chip, không badge navy:** trang chi tiết vẽ lại nhãn bằng dữ liệu gốc của `TASK_STATUS/OVERDUE_STATUS/PRIORITY` — quá hạn `on-blush` trên Blush/45, chờ/đang làm Ink alpha trên Oat/60, hoàn thành Sage/45 với dấu Check, nhãn ưu tiên giữ dot màu dữ liệu (không phải màu skin). "Nhắc dai" và chuông báo thức mang **Bell gold** (khoảnh khắc chuông, không phải field).
- **Form da phòng:** `RoomField/RoomInput/RoomTextarea/RoomSelect/RoomSegmented/RoomToggle` (thành viên mới của `RoomUI`, nguyên tắc additive như M2 — mặc định navy không đổi); viền chọn giờ/viết con đều h-11; chip nhãn PRO/đếm = Oat/70; **viên chọn trái/luân phiên = Acorn (text paper)**; liên kết "💡"emoji của nhắc lặp đổi thành icon `BellRinging` (craft floor: không emoji làm icon). Thanh hành động dưới cùng chỉ là **giấy đặc + ring Acorn/25** — không `backdrop-blur` (no glass).
- **Modal da phòng:** `Modal` nhận `skin="room"` (additive): tấm giấy Porcelain + ring Acorn/25, header/footer dải phẳng Acorn/15, **backdrop `bg-room-ink/45` không blur**; mặc định 'classic' giữ nguyên bản navy cho chỗ khác.
- **Không "đặt khi chưa có":** số hiển thị trên phòng lấy từ `getDashboard` (tổng `deskRows` đã dedupe, `completedCount` từ máy chủ). Trang mới chưa làm (Lịch, Kế hoạch tuần, Báo cáo…) vẫn navy — mở đúng trạng thái hiện tại, không paint-over.

## Trang Lịch (mốc M4)

Vẫn là **Operate**: `CalendarPage.jsx` (~1480 dòng — header, thanh điều khiển, 4 lưới xem Tháng/Tuần/Ngày + TKB theo giờ, 3 panel quản lý) đổi da nguyên trang về token phòng; logic/API/chuỗi giữ nguyên 100%. Imports sạch: bỏ `Button/Skeleton/StatusBadge/PriorityBadge`, thay bằng `RoomButton/RoomCard/RoomSkeleton/RoomSegmented` + `PRIORITY`.

- **Thanh điều khiển:** mũi tên trước/sau + "Hôm nay" là nền Oat/45 hover Oat/75; nhóm chuyển xem là `RoomSegmented size sm`; toggle "Lịch học" bật = **Moss/60** + ring Acorn/25; tiêu đề tháng/tuần/ngày dùng `font-display` Ink. Card chính và panel chi tiết dưới cùng là `RoomCard` (ring Acorn/25) thay `card`.
- **Ô ngày lịch (MonthGrid/WeekGrid):** nền Oat/35 hover Oat/65, chọn = **ring-2 Acorn cả khung + Oat/70**, "hôm nay" = đĩa Acorn chữ paper, ngoài tháng `bg-transparent opacity-40`. Dot việc giữ **màu dữ liệu category** (fallback Acorn hex `#8b6f4e` vì ghép chuỗi alpha số); sự kiện lịch ngoài = chữ nghiêng mảnh tô màu lịch riêng — nhìn ra khác việc cá nhân.
- **Xung đột TKB × việc cá nhân = Bell gold, không rose:** chip đếm `bg-room-bell/25 ring-room-bell/50`, slot vướng gets `ring-2 ring-room-bell`, khối cảnh báo `bg-room-bell/20 ring-room-bell/40` — "hai chuông cùng lúc" là khoảnh khắc chuông, đúng luật Bell; tiêu đề slot/link trong khối gạch chân đậm Bell. Đường lưới TKB = nét đứt Acorn/15–20, nhãn giờ `text-room-ink/30`.
- **Panel Lịch học:** kết nối thành công = dải **Sage/25** + ring Acorn/20 (thành công phẳng, không gradient); "Đồng bộ ngay" RoomButton sm, "Ngắt kết nối" RoomButton `danger` (**pill Rain** — thế giới không đỏ); `lastError`, nhãn phiên trường, "đang tải danh mục" = **Rain trung tính** (Rain/25–35 + ring Rain). Form mật độ py-2 dùng `roomFieldCls` cục bộ (không `RoomInput` — các ô nhỏ có width riêng như `w-[84px]`); select dùng `roomSelectCls` + `ROOM_ARROW_URL` (RoomUI export mũi tên Acorn dùng chung). Danh sách tiết = giấy + ring Acorn/15, thùng rác = Ink/30 hover Acorn (không rose).
- **Panel Lịch ngoài:** biểu tượng/chip đếm mang **Rain** (dữ liệu chảy vào từ bên ngoài — trung tính), hàng lịch trên Oat/40; nút đồng bộ/thùng rác neutral hover Acorn. Form thêm lịch = `roomFieldCls`.
- **Liên kết phụ:** `.btn-link` của shell vẫn dùng trong trang — override mới `.room-world .btn-link` (Ink/60, hover Acorn) đổi màu cả nơi dùng mà không đụng shell cũ.
- **Raster provenance:** `.impeccable/review/`
  - `m4-calendar-dark.png` — trang Lịch chế độ tối, view Tháng
  - `m4-calendar-light.png` — cùng viewport chế độ sáng

## Kế hoạch tuần + Báo cáo + lô nhẹ (mốc M5)

Vẫn là **Operate**: 5 trang (PlannerPage, ReportsPage, CategoriesPage, NotificationHistoryPage, RewardsPage) đổi da nguyên trang về token phòng; logic/API/chuỗi giữ nguyên 100%. Một ngoại lệ đã duyệt: sửa 1 bug pre-existing của PlannerPage — `{data?.goldenHour?.hour !== null}` thành `!= null` (optional chaining trả `undefined` ≠ `null` nên khối "Giờ vàng" vẫn render khi `goldenHour` là `null` và crash khi đọc `.hour`) — về đúng ý định gốc, không đổi hành vi nào khác.

- **Kế hoạch tuần: tuyên bố bằng tông, không bằng banner gradient.** Chip "Pro" bỏ gradient violet→fuchsia, thành Oat/70 + ring Acorn/25 (cả LockedPanel lẫn header); chọn sức mình = `RoomSegmented sm`; khối tổng kết trắng-on-gradient (amber-orange-rose / emerald-teal-cyan) thành **verdict panel**: quá tải = Bell/25 + ring Bell/40, vừa sức = Sage/25 + ring Acorn/20, các con số nằm trên chip giấy (`bg-room-paper`); khối "Sẽ trễ hạn" = giấy + ring Bell/40 với pill "Trễ X ngày" Bell/25; Giờ vàng = đĩa Bell/25 ring Bell/40; thẻ ngày ring Acorn/25, ngày hôm nay **ring-2 Acorn**; hàng việc Oat/40 ring Acorn/15, nút check Ink/30 hover Sage, chip quá hạn Blush/45 `on-blush`, nhắc dai của nó Bell/20; "Tuần sau" dùng Rain trung tính.
- **Báo cáo: biểu đồ thuần CSS rời gradient.** `STAT_TONES` cục bộ — hoàn thành Sage/45, chuỗi ngày/trễ dự báo Bell/25, đang quá hạn Blush/45 (count 0 → Oat/60), còn lại Oat; DailyChart/WeekdayChart bỏ gradient hoàn toàn — cột/bar **solid Acorn**, ngày trống là stub Oat/50; dòng Danh mục giữ `c.color` cho dot lẫn bar (fallback `#8b6f4e` — màu dữ liệu); HourStrip đậm nhạt bằng opacity trên Acorn, ô giờ vàng ring-2 Bell; tooltip `bg-room-ink text-room-paper`; insight block = Oat/45 + Sparkle Bell (thay gradient blue-indigo-violet); khối "Việc đang bị bỏ quên": "Quá hạn X ngày" Blush/45 on-blush, chuỗi nhắc dai Bell/20.
- **Danh mục:** thẻ = `RoomCard` hover ring Acorn/50; đĩa giữ `cat.color` (dữ liệu) với viền trong black/10; nút sửa/ẩn Ink/35 hover Oat/75; chip "Đã ẩn" Oat/70; thanh đếm track Oat/70 fill màu dữ liệu; Modal **skin="room"** + `RoomField/RoomInput` + footer RoomButton; **RoomColorPicker cục bộ** thay ColorPicker navy của Inputs.jsx (vẫn phục vụ shell cũ) — ô màu dữ liệu giữ nguyên, vành chọn = ring-2 Acorn trên offset paper; EmptyState → RoomEmpty (FolderSimple + RoomButton sm).
- **Lịch sử thông báo:** filter = RoomSegmented sm; hàng = `RoomCard as="article"`; đĩa chuông Bell/25 ring Bell/40; chip kết quả vẽ local (`RoomActionChip`) đọc nhãn từ `NOTIFICATION_ACTION` — "Đã gửi" Bell/25 (cú chuông), "Đã hoãn" Rain/40, "Đã tắt" Oat/60, "Đã hủy" Rain/60; phân trang RoomButton secondary.
- **Phần thưởng: hero từ max-gradient về giấy.** Bỏ nguyên gradient navy→slate, 2 orb blur-3xl và `backdrop-blur` (no glass) → RoomCard; đĩa Flame Bell/25, nhãn "ngày liên tiếp" Bell; khay điểm Oat/50 + Acorn/20; dải 7 ngày: ngày có điểm = Bell/40, hôm nay = Oat/50 ring Acorn/25, ngày lỡ = Rain/40 Ink/35; luật chơi — đĩa Oat, riêng luật chuỗi = Bell; mã mời mono trên Oat/50; note chống gian lận = Rain (thay amber); lời mời trạng thái "Đã thưởng ✓" Sage/45, "Chờ kích hoạt"/"Không hợp lệ" Rain; thẻ đổi thưởng PRO = Oat/55 + Acorn/35 (Sparkle Bell), PLUS = Oat/35, thanh tiến độ **solid Acorn** (PRO 100%, PLUS 75%) thay gradient violet/xanh; "Đã đổi gần đây" Sage/25; lịch sử điểm: cộng = Oat/70, trừ = Rain/50 — không emerald/rose.
- **Raster provenance:** `.impeccable/review/` — `m5-planner-dark/light.png`, `m5-reports-dark/light.png`, `m5-categories-dark/light.png`, `m5-notifications-dark/light.png`, `m5-rewards-dark/light.png` (chụp ngày 5/11, dữ liệu thật của tài khoản demo qua API local: kế hoạch 4 việc còn 31 chỗ trống, Giờ vàng 11h, 4 quá hạn, streak 2, 20 điểm — không số bịa nào trong build).

## Do's and Don'ts

### Do:
- **Do** wrap room-world pages in `.room-world` and theme everything through `room.*` Tailwind tokens (`bg-room-moss/70`, `ring-room-acorn/25`) so light/dark switch from the single `--room-*` variable block; never hardcode navy/slate inside it.
- **Do** keep text-on-Blush as `.on-blush` Ink `#4A3B2C` in both themes — baked by contrast, not by theme.
- **Do** prove product truth: the wall clock ticks real time, "today" is `Intl`-formatted real date, and every invented figure wears the Blush MẪU/DEMO chip; never ship an unlabeled sample number.
- **Do** draw all seams as dotted (`dot-divider`, dotted underlines, dashed frames) and all strokes/rings as Acorn at alpha; hairline solids only inside a footer.
- **Do** stay flat: sticker props stand upright on the floor, motion stays at ≤2px hover lifts and once-only reveals (`threshold 0.15`, house easing `cubic-bezier(0.16, 1, 0.3, 1)`), with `prefers-reduced-motion` honored.
- **Do** carry the two registered exceptions as scoped, not general: the six-drawer cabinet (one shell, waivered `nested-cards` → `LandingPage.jsx`) and the authored room illustration (waivered `shape-assembled-illustration` → `RoomScene.jsx`).
- **Do** skin every guest form through `RoomUI` (`RoomField`/`RoomInput`/`RoomButton`/`RoomDots`) so the one ramp holds everywhere: Acorn/25 rings at rest, Rain rings on invalid, the 44px entry/toggle floor, `size lg` (`h-12`) for main actions.
- **Do** keep wall furniture economical: on the auth wall, one taped card ("Nhật ký đúng hạn" — tape Oat/90 turned −5°, ring Acorn/20, floating-card weight beneath) and three Moss blips; the landing rail's three taped cards are that page's furniture, not a wall pattern to replicate.

### Don't:
- **Don't** blue-black the dark theme — Porcelain goes warm #2B231E and the lamp does the lighting; no slate/navy grounds inside the room world.
- **Don't** color-glow, gradient-border, or beam anything (no `glow-ring`, `gradient-border`, `route-beam`, `hero-glow`, brand gradients) — the world's only breathing light is the Blush due-glow and the night lamp.
- **Don't** pink anything other than the due state on app chrome; Bell gold stays on sounding/burning props, never as a field.
- **Don't** uppercase or letter-space-tighten headings, and don't substitute system display faces — Baloo 2 rest, Nunito reads.
- **Don't** invent hard offset shadows or 3D card tilts; depth is drawn, and shadow vocabulary stays the four paper weights listed above.
- **Don't** paint errors rose or red — Rain/30 panels, Rain rings and bold Ink copy are the whole error kit; only the due state owns an alarm color.
- **Don't** gradient or glow the room wordmark — `WorldLogo` is solid Baloo 2 token lettering (Ink / Acorn Q / Ink); the gradient logotype stays in the old shell's `Logo.jsx`.
- **Don't** light the lamp in daylight — `.lamp-glow` holds opacity 0 until `.dark` (then 0.55); in light mode the only breathing light is the Blush due-glow.
- **Don't** break the route/label truth: routes `/ /app /login /register /pricing`, anchors `#tinh-nang #cach-hoat-dong #gioi-thieu #lien-he`, `EXTENSION_STORE_URL`, `DESKTOP_DOWNLOAD_URL` stay exactly as shipped; names of unrealized features don't appear as live UI.
