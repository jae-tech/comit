# Comit — Design System

Design tokens and UI patterns extracted from `globals.css` and the component library. Use this as the reference when adding new UI.

---

## Color Palette

### Surfaces (warm off-white)
| Token | Value | Usage |
|---|---|---|
| `--bg` / `bg-[#faf9f7]` | `#faf9f7` | Page background |
| `--surface` | `#f4f3f0` | Subtle secondary surface |
| `--surface-2` | `#eceae5` | Tertiary / hover fills |
| `--border` / `border-stone-200` | `#e7e5e0` | Default card/input border |
| `--border-2` / `border-stone-300` | `#d6d3cc` | Focused / hover border |

> In Tailwind classes, map: `bg-[#faf9f7]` = page bg, `bg-white` = card bg, `border-stone-200` = default border.

### Text
| Token | Tailwind approx. | Usage |
|---|---|---|
| `--text` | `text-stone-900` | Primary body text |
| `--text-muted` | `text-stone-500` / `text-stone-600` | Secondary/helper text |
| `--text-faint` | `text-stone-400` | Placeholder, timestamps, labels |

### Accent — blue
| Token | Value | Usage |
|---|---|---|
| `--accent` | `#1d4ed8` (blue-700) | Primary button bg, focus ring |
| `--accent-h` | `#1e40af` (blue-800) | Hover state for primary button |
| `--accent-text` | `#eff6ff` | Text on accent bg |
| `--accent-sub` | `#dbeafe` (blue-100) | Accent icon containers |

### Semantic
| Token | Value | Usage |
|---|---|---|
| `--success` / green-700 | `#15803d` | Ready status, success toast |
| `--error` / red-700 | `#b91c1c` | Failed status, error toast |
| `--warning` / amber-700 | `#b45309` | Warning states |

---

## Typography

**Body font:** `Instrument Sans` — loaded via Google Fonts  
**Mono font:** `Geist Mono` — used for code, data, citations, chunk indexes, file sizes

| Scale | Tailwind | Usage |
|---|---|---|
| 11px | `text-xs` | Badges, metadata labels |
| 13px | `text-xs` + tracking | Section headings (uppercase, `tracking-wider`) |
| 14px | `text-sm` | Default UI text, list items, buttons |
| 15px | body default | Main reading copy |
| 18px | `text-lg` | Page titles inside forms |
| 20px | `text-xl` | Primary page headings |

Section label pattern: `text-xs font-medium text-stone-500 uppercase tracking-wider`

---

## Border Radius

| Token | Value | Tailwind | Usage |
|---|---|---|---|
| `--r-sm` | `4px` | `rounded` | Small chips, inner elements |
| `--r-md` | `6px` | `rounded-md` | Buttons, inputs, status badges |
| `--r-lg` | `8px` | `rounded-lg` | Cards, list items, panels |
| `--r-xl` | `12px` | `rounded-xl` | Icon containers only |
| `--r-full` | `9999px` | `rounded-full` | Status badge pills |

**Rule:** Cards, form panels, list rows → `rounded-lg`. Icon avatars → `rounded-xl`. Badges/pills → `rounded-full`. Buttons/inputs → `rounded-md` (via shadcn defaults).

---

## Spacing

The app uses an 8px base grid. Common patterns:

- Page content max-width: `max-w-2xl mx-auto` (chat), `max-w-xl mx-auto` (settings/docs)
- Horizontal page padding: `px-4`
- Vertical page padding: `py-8`
- Card internal padding: `px-4 py-3` (list items), `p-8` (auth forms)
- Section gap: `gap-8` (settings page sections)
- Item gap: `gap-2` (list), `gap-5` (chat messages)

---

## Component Patterns

### Cards / List Items
```
bg-white rounded-lg border border-stone-200 px-4 py-3 shadow-sm
hover: border-stone-300 transition-colors
```

### Icon Containers
```
w-8 h-8 rounded-xl bg-{color}-50 flex items-center justify-center shrink-0
```
Sizes: `w-8 h-8` (standard), `w-12 h-12` (empty state illustration)

### Status Badges (pill)
```
inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
```
| Status | Classes |
|---|---|
| pending | `text-stone-400 bg-stone-100` |
| processing | `text-blue-600 bg-blue-50` |
| ready | `text-green-700 bg-green-50` |
| failed | `text-red-600 bg-red-50` |

### Buttons (shadcn/ui `Button`)
- `size="sm"` — default for header and inline actions
- `size="icon"` — icon-only (always add `aria-label`)
- `variant="ghost"` — secondary/toolbar actions
- `variant="outline"` — secondary with visible border

### Section Labels
```
text-xs font-medium text-stone-500 uppercase tracking-wider mb-{2|3}
```

### Empty States
```
flex flex-col items-center gap-3 py-20 text-stone-400
  └── w-12 h-12 rounded-xl bg-stone-100 (icon container)
  └── text-sm (message)
  └── Button size="sm" variant="outline" (CTA)
```

### Skeleton Loaders
Use `animate-pulse` divs that match the shape of the real content. Background: `bg-stone-100`. Border radius matches the real element. Do not show spinners for initial page loads.

---

## Page Layout

### App shell
```
AppHeader (fixed top bar)
  ← back button | title [subtitle] | right slot (actions)
main (scrollable, CONTENT_WIDTH padding)
```

`CONTENT_WIDTH = "mx-auto w-full max-w-2xl px-4"` (defined in `app-header.tsx`)

### Auth pages (login / register)
```
flex min-h-screen items-center justify-center bg-[#faf9f7]
  └── w-full max-w-sm
        ├── brand mark (centered)
        ├── bg-white rounded-lg border border-stone-200 p-8 shadow-sm (form card)
        └── "already have account?" link
```

### Chat page
```
flex h-[100dvh] flex-col   ← dvh handles iOS virtual keyboard
  ├── AppHeader
  ├── flex-1 overflow-y-auto  (message list)
  └── shrink-0 border-t bg-white/90 backdrop-blur-sm  (input bar)
```

---

## Animation

Duration: `150ms` (hover), `200ms` (Sheet open/close), `300ms` (slower transitions).  
Easing: `ease` for color/bg, no custom curves.

Sheet (drawer) uses `slide-in-from-right` / `slide-out-to-right` at `200ms` for right-side sheets. Left-side sheets (session history) use the inverse.

---

## Accessibility

- Icon-only buttons **must** have `aria-label` describing the action and target (e.g. `aria-label='"filename" 삭제'`).
- Color is never the sole status indicator — status badges always include an icon + text label.
- Focus rings: `focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700` on inputs.
