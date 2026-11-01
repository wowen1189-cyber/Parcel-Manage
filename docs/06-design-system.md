# 06 — Design system (Parcel)

Matches the Parcel prototype. Calm, warm, modern; rounded cards and pill tags; no gradients or emoji in the UI.

## Color tokens
| Token | Hex | Use |
|---|---|---|
| `bg` | `#f9f6f2` | App background (warm off-white) |
| `surface` | `#FFFFFF` | Cards, panels, inputs |
| `surface-muted` | `#f5f2ed` | Table headers, inset boxes |
| `surface-sunk` | `#efece6` | Neutral pills, hover, sunken areas |
| `border` | `#e9e6e0` | Card and divider lines |
| `border-strong` | `#d5d2cb` | Inputs, secondary buttons |
| `text` | `#14201c` | Primary text (deep green-black) |
| `text-2` | `#38352f` | Secondary text |
| `text-muted` | `#4f4b44` | Descriptions |
| `text-subtle` | `#67635b` | Captions, timestamps (passes 4.5:1 on white) |
| `accent` | `#007852` | Primary buttons, links, selected nav |
| `accent-hover` | `#006042` | Primary hover |
| `accent-deep` | `#043728` | Text on light green |
| `accent-soft` | `#ceefe1` / `#e7f8f1` | Selected states, success backgrounds |
| `info` | bg `#d9f3ff`, text `#005998` | Info pills and notes |
| `warn` | bg `#fff1c8`, text `#875814` | Late, pending, watch |
| `danger` | bg `#ffe6e1`, text `#b63325` | Delinquent, emergency, errors |
| `dark` | `#14201c` | Balance card, selected chips |

Status pill mapping: Current/Completed/Approved/On target → accent-soft; Late/Pending/Watch/Needs approval → warn; Delinquent/Emergency/Off target → danger; Renewal due/Listed/Info → info; Vacant/Draft → surface-sunk.

## Type
- **Archivo** 400/500/600/700/800 (Google Fonts). Body 14px/1.45; page titles 30px/800 with -0.015em tracking; section titles 16–18px/700; big numbers 26–36px/700 tabular figures.
- **Caveat** 600 only for the handwritten signature line on letters.

## Shape and spacing
- Radius: cards 12–14px, inputs and buttons 10–12px, pills 999px, dialogs 18px.
- Spacing scale 4/6/8/10/12/14/16/20/24/28/32.
- Touch targets ≥ 44px; inputs 40–46px high.

## Layout
- Manager app: left sidebar (220px, white, logo block "PM · Parcel Manage" (Parcel family mark, same as Parcel TM: brand deep green `#032017` tile, white "PM", gold `#f7bd40` dot; the wordmark ends in a gold period. Buttons stay accent `#007852`: TM's `#008b61` is under 4.5:1 with white text) + company name), content area max ~1280px, top bar with page title + subtitle, "+ New" primary button. Sidebar stacks on phones.
- Portals: phone-first; bottom tab bar; one column; 16–20px side padding.
- Tables: header row on `surface-muted`, 1px row dividers, numbers right-aligned tabular, horizontal scroll inside the card on small screens.

## Components (build these once)
Button (primary, secondary/ghost, danger, small), Pill/Badge, Card/Section, Stat tile, Tabs (segmented, on `#e9e6e0` track with white selected tab), Chips (filter), Toggle switch, Input/Select/Textarea with labels, Data table (sort, filter, CSV export, empty state), Timeline/status stepper (delivery-style), Drawer/side panel (AI assistant), Modal, Toast, File upload/drop zone, Photo capture (portal), Progress bar (stepper), Message thread (bubbles: own = accent, other = white with border), Letter/document preview, Mini bar trend (12 bars, last bar accent).

## Voice
Plain, short sentences; sentence-case headings; say what will happen ("Assigning a vendor emails and texts them"). Warnings say what to do next. No jargon in tenant and vendor portals.
