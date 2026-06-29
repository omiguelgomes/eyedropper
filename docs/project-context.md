# Project Context: eyedropper

## Testing Standards

Every story that adds or changes code must include a "Write tests" task. Follow these rules:

### Framework

- **Unit/component tests**: Vitest + React Testing Library (`@testing-library/react`, `@testing-library/user-event`)
- **Config file**: `eyedropper-web/vitest.config.ts`
- **Test files**: co-located next to the file under test, e.g. `lib/color-sample.test.ts`, `components/Upload.test.tsx`
- **Run**: `npm test` from `eyedropper-web/`

### What to test per story

| Code type | What to test |
|-----------|-------------|
| Pure functions (`lib/*.ts`) | All branches, edge cases, return values |
| React components | Render output, user interactions (click, drag, type), conditional rendering, error states |
| API routes (`app/api/*/route.ts`) | Happy path response shape, error handling — mock `fs`, `sharp`, `crypto` with `vi.mock()` |

### What NOT to test

- Next.js framework behavior (routing, SSR)
- Tailwind CSS class names
- Stub files that contain only `return placeholder` (e.g. Story 1.1 stubs that are explicitly marked "implementation in Story X.Y")

### Test task template (add to every story's Tasks/Subtasks)

```
- [ ] Task N: Write tests (AC: all)
  - [ ] Unit tests for any pure functions added/changed in this story
  - [ ] Component tests for any React components added/changed
  - [ ] API route tests for any route handlers added/changed
  - [ ] Run `npm test` — all tests pass, no regressions
```

## Hydration rules (Next.js App Router)

- `app/page.tsx` and all page/layout files must be server components (no `"use client"`) unless they directly use hooks
- Browser-only state (window size, etc.) belongs in client components via `useEffect`; initialize as `null` to avoid SSR/client mismatch
- Pattern: `const [value, setValue] = useState<T | null>(null)` + `useEffect(() => setValue(window.X), [])` + early `if (value === null) return null`

## Architecture constraints

- All source files live under `eyedropper-web/` (Next.js project root)
- Types live in `lib/types.ts` — import `EyedropperPoint`, `EditorState`, `LabelDefaults` from there
- CSS design tokens are CSS variables in `app/globals.css` — reference as `var(--color-*)` in Tailwind arbitrary values: `bg-[var(--color-bg)]`
- Tailwind v4 is installed (`@import "tailwindcss"`) — no `tailwind.config.ts`, no `theme.extend`
