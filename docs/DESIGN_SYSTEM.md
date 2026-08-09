# Design System

## Visual direction

Neon Underworld presents as a premium digital OS for a criminal empire — neo-noir, calm, intelligence-agency clarity.

## Principles

- Dark charcoal foundation (`#0c0c0e`)
- Gold primary accent (`#c9a962`)
- Restrained cyan, purple, green, red for status
- Fine borders, subtle glass, minimal glow
- Strong typography hierarchy over boxed cards
- Mobile-first (320px–390px primary targets)

## Typography

- **Display:** Playfair Display — headings, brand
- **UI:** Inter — body and interface
- **Mono:** JetBrains Mono — figures and metrics

## Components

Located in `src/components/`:

| Component | Use |
|-----------|-----|
| `AppShell` | Layout with bottom navigation |
| `TopBar` | Command header with greeting |
| `BottomNavigation` | 5 destinations |
| `ResourceMetric` | Turns, cash, rank display |
| `StatusBadge` | Morale, readiness indicators |
| `AttentionCard` | Recommended action |
| `ActionButton` | Primary/secondary/ghost actions |
| `SectionHeader` | Section titles |
| `AlertRow` | Warning/info alerts |
| `ActivityRow` | Feed items |
| `EmptyState` | Placeholder pages |
| `ResultSummary` | Scout results |
| `NumberStepper` | Turn amount selection |
| `FormField` | Auth forms |
| `LoadingSkeleton` | Loading states |

## Motion

- 150–250ms transitions
- Scout result reveal (no casino effects)
- `prefers-reduced-motion` respected

## Accessibility

- Semantic HTML, ARIA labels on interactive elements
- Visible focus rings (gold outline)
- 44px minimum touch targets
- Screen reader announcements on scout results (`aria-live`)
- Status communicated with text + color

## Color tokens

Defined in `src/styles/globals.css` as CSS custom properties.
