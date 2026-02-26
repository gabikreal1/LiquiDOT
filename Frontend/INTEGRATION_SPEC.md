# LiquiDOT Frontend Integration Spec

> Integrating `liquidot_front` into `LiquiDOT/Frontend` — complete rebuild on the new design system with real wallet + backend wiring.

---

## 1. High-Level Summary

Replace the existing LiquiDOT/Frontend with the liquidot_front codebase as the foundation, then layer on:
- Real Wagmi wallet connection (MetaMask, Coinbase, WalletConnect)
- Full SIWE/SIWS authentication flow with JWT
- Live NestJS backend API integration (replacing mock data)
- Asset Hub deposit flow (AssetHubVault contract)
- SSE real-time position updates

**Migration strategy:** New git branch (`feat/frontend-v2`), incremental integration. Do not delete existing Frontend until the new branch is validated.

---

## 2. Technology Stack (Target)

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 16.1.6 | Upgrade from 15. Turbopack enabled. |
| React | 19.x | Same as current |
| CSS | Tailwind CSS v4 | CSS-first config via `@tailwindcss/postcss`. Migrate all existing components. |
| Design tokens | CSS custom properties in `globals.css` | `--ld-*` prefix. Minimal `tailwind.config.ts` for plugins only. |
| Design system | Teal/green (`--ld-primary: #0D6B58`, `--ld-accent: #00E5A0`) | Replaces purple/fuchsia theme entirely. Light mode only (dark mode: future enhancement). |
| Fonts | Space Grotesk (display), Outfit (body), JetBrains Mono (mono) | Replace current font stack |
| Animations | motion/react + GSAP | Replace framer-motion with motion/react. GSAP for scroll-triggered landing sections. |
| State management | Zustand | Replace React Context (WalletContext, BackendUserContext) with Zustand stores. |
| Server state | TanStack React Query v5 | Keep existing pattern, adopt liquidot_front's query key conventions. |
| Wallet | Wagmi v2 + Viem | Preserve from existing Frontend. Configure for Asset Hub + Moonbeam chains. |
| Auth | SIWE/SIWS → JWT | Full sign-in-with-wallet flow. JWT stored in Zustand (persisted). |
| UI components | shadcn/ui from liquidot_front | Replace existing 50+ components with liquidot_front's smaller, restyled set. Add more via `shadcn` CLI as needed. |
| 3D | Three.js (@react-three/fiber + drei) | Landing page hero planet only. Dynamic import. |
| Smooth scroll | Lenis | Landing page only. Never on app pages (dashboard, pools, etc.). |
| Package manager | npm | Switch from pnpm. New package-lock.json. |
| Testing | Jest (existing) + Storybook v10 (new) | No Playwright. Storybook for component dev/documentation. |
| Mock data | Retained as dev fallback | Toggle via `NEXT_PUBLIC_USE_MOCK=true`. Default: real API. |

---

## 3. Pages & Routing

### 3.1 Public pages (no wallet required)

| Route | Source | Notes |
|-------|--------|-------|
| `/` | liquidot_front landing | Full replacement: 3D hero, trust bar, features bento, how-it-works, architecture, chains, pools preview, testimonials, CTA, footer. Lenis smooth scroll. |
| `/pools` | liquidot_front pools page | **Hybrid auth**: browsable without wallet. "Invest" actions gated behind wallet connection. |

### 3.2 Protected pages (wallet + auth required)

| Route | Source | Notes |
|-------|--------|-------|
| `/dashboard` | **Hybrid**: liquidot_front visual design + existing data layer | New components (portfolio-card, strategy-strip, donut-chart, activity-feed, positions-table, chain-status) wired to existing `useDashboard(userId)` hook and `GET /api/dashboard/:userId`. |
| `/dashboard/strategy` | liquidot_front strategy page | Form maps to `PATCH /api/preferences/:userId`. Add "Preview" button → `POST /api/investmentDecisions`. Add "Run Now" button → triggers immediate execution. |
| `/dashboard/positions/[id]` | liquidot_front position detail | Full page: hero, P&L breakdown, range visual, timeline, transactions. Wired to `GET /api/positions/:id` + `GET /api/positions/:id/pnl`. |
| `/dashboard/settings` | liquidot_front settings page | Full UI with placeholders. Account + wallet hero: functional. Connected chains, notifications, danger zone: show "Coming Soon" badges where backend doesn't support. |
| `/activity` | liquidot_front activity page | Fetches from `GET /api/users/:userId/activity`. Filters by type/status applied **client-side** (backend doesn't support filter params yet). Summary strip counts computed client-side. |

### 3.3 Utility pages

| Route | Source |
|-------|--------|
| `/not-found` | liquidot_front 404 |
| `/error` | liquidot_front error boundary |
| `/robots.ts` | liquidot_front |
| `/sitemap.ts` | liquidot_front |

---

## 4. Authentication & Authorization

### 4.1 Auth flow

```
1. User clicks "Connect Wallet" in navbar
2. Wagmi modal opens (MetaMask / Coinbase / WalletConnect)
3. On wallet connect → generate SIWE message with nonce from backend
4. User signs message in wallet
5. POST signed message to backend auth endpoint → receive JWT
6. Store JWT + userId + walletAddress in Zustand auth store (persisted to localStorage)
7. All subsequent API calls include Authorization: Bearer <jwt> header
```

### 4.2 Zustand auth store

```typescript
interface AuthState {
  isAuthenticated: boolean;
  jwt: string | null;
  userId: string | null;
  walletAddress: string | null;
  login(jwt: string, userId: string, walletAddress: string): void;
  logout(): void;
}
```

- Uses `persist` middleware (localStorage key: `liquidot-auth`)
- On logout: clear store, disconnect Wagmi, invalidate all React Query caches
- API client reads JWT from store for `Authorization` header

### 4.3 Zustand UI store

```typescript
interface UIState {
  mobileMenuOpen: boolean;
  setMobileMenuOpen(open: boolean): void;
}
```

### 4.4 Route protection

- Dashboard layout (`app/dashboard/layout.tsx`) checks `isAuthenticated` from Zustand store
- If not authenticated → redirect to `/` or show connect-wallet prompt
- Public pages (`/`, `/pools`) render without auth
- Hybrid behavior on `/pools`: "Invest" buttons check auth, show connect-wallet dialog if not connected

---

## 5. Navbar

**Design**: liquidot_front navbar visual design
**Functionality**: Real Wagmi wallet integration

- Logo + nav links (Home, Pools, Dashboard — Dashboard visible only when authenticated)
- **Not connected**: "Connect Wallet" button → Wagmi connect modal → SIWE flow
- **Connected**: Truncated address display, avatar, dropdown (Dashboard, Settings, Disconnect)
- Mobile: Sheet-based mobile menu (liquidot_front's mobile-menu component)

---

## 6. API Integration

### 6.1 API client

Based on liquidot_front's `lib/api/client.ts` but enhanced:

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { jwt } = useAuthStore.getState(); // Read JWT from Zustand
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };
  // ... fetch with error handling, 401 → logout
}
```

- On 401 response: auto-logout (clear Zustand store, redirect to `/`)
- Mock fallback: if `NEXT_PUBLIC_USE_MOCK=true`, import from `lib/mock/` instead of fetching

### 6.2 Endpoint mapping

| Frontend action | Backend endpoint | Auth | Notes |
|----------------|-----------------|------|-------|
| Fetch dashboard | `GET /api/dashboard/:userId` | JWT | Existing, works |
| List pools | `GET /api/pools?minTvl=&minApr=&limit=&offset=` | Public | Missing: sort, order, chain, dex (see §6.3) |
| Search pools by token | `GET /api/pools/search?token=SYMBOL` | Public | Existing |
| Top pools | `GET /api/pools/top?limit=5` | Public | Existing |
| Get position | `GET /api/positions/:id` | JWT | Existing |
| Get position P&L | `GET /api/positions/:id/pnl` | JWT | Existing |
| Get preferences | `GET /api/preferences/:userId` | JWT | Existing |
| Save preferences | `PATCH /api/preferences/:userId` | JWT | Existing |
| Get default preferences | `GET /api/preferences/defaults` | Public | Existing |
| Preview investment | `POST /api/investmentDecisions` | JWT | Existing (returns recommendations) |
| User activity | `GET /api/users/:userId/activity?limit=&offset=` | JWT | No type/status filters (client-side) |
| Register user | `POST /api/users` | Public | Existing |
| SSE position events | `GET /api/positions/user/:userId/events` | JWT | Existing |

### 6.3 Backend changes needed (spec note)

The following query params are NOT yet supported by `GET /api/pools` and should be added to the backend in a follow-up:

| Param | Type | Description |
|-------|------|-------------|
| `sort` | string | Sort column: `apr`, `tvl`, `volume24h`, `fee`, `pool`, `chain` |
| `order` | `asc` \| `desc` | Sort direction (default: `desc`) |
| `chain` | string | Filter by chain: `asset-hub`, `moonbeam` |
| `dex` | string | Filter by DEX: `algebra`, `stellaswap` |
| `token` | string | Token symbol search (currently only on `/pools/search`) |

**Interim**: Frontend displays all filter UI. `sort`/`order`/`chain`/`dex` filtering is applied client-side. `token` search uses `/pools/search` endpoint.

The activity endpoint (`GET /api/users/:userId/activity`) should also add `type` and `status` query params in a follow-up. Interim: client-side filtering.

---

## 7. Deposit & Withdrawal Flow

### 7.1 Target chain: Asset Hub

Per the system architecture, deposits go to **AssetHubVault on Asset Hub** (not Moonbeam XCM Proxy).

### 7.2 Deposit flow

```
1. User navigates to deposit UI (new component, liquidot_front design language)
2. User enters DOT amount (minimum: 30 DOT on testnet)
3. Frontend calls AssetHubVault.deposit() via Wagmi useWriteContract
   - Chain: Asset Hub (chainId: 420420419 testnet / 420420419 mainnet)
   - Contract: AssetHubVault address from env var
4. Wait for transaction confirmation
5. Backend picks up the deposit event and updates user balance
6. Dashboard refreshes via SSE event or React Query invalidation
```

### 7.3 Withdrawal flow

```
1. User requests withdrawal from dashboard or settings
2. Frontend calls AssetHubVault.withdraw() via Wagmi
3. Funds returned to user's wallet on Asset Hub
```

### 7.4 Contract configuration

```env
NEXT_PUBLIC_ASSETHUB_VAULT_ADDRESS=0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6  # testnet
NEXT_PUBLIC_ASSETHUB_CHAIN_ID=420420422  # Paseo testnet
```

---

## 8. Strategy Page

### 8.1 Form sections (from liquidot_front)

1. **Preset buttons**: Conservative / Moderate / Aggressive (pre-fill form values)
2. **Investment section**: minApy, maxPositions, maxAllocPerPositionUsd, minPositionSizeUsd
3. **Ranges section**: defaultLowerRangePercent, defaultUpperRangePercent
4. **Pool filters section**: minTvlUsd, minPoolAgeDays, allowedTokens, preferredDexes
5. **Safety section**: maxIlLossPercent, dailyRebalanceLimit, expectedGasUsd
6. **Automation section**: autoInvestEnabled, investmentCheckIntervalSeconds
7. **Advanced section**: lambdaRiskAversion, thetaMinBenefit, planningHorizonDays

### 8.2 API wiring

| Action | Endpoint | Method |
|--------|----------|--------|
| Load current preferences | `GET /api/preferences/:userId` | GET |
| Load defaults (new user) | `GET /api/preferences/defaults` | GET |
| Save preferences | `PATCH /api/preferences/:userId` | PATCH |
| Preview recommendations | `POST /api/investmentDecisions` | POST |
| Execute now | `POST /api/investmentDecisions` | POST (with execute flag) |

### 8.3 Strategy sidebar

liquidot_front's strategy-sidebar component shows a live summary of current settings. Wire to React Query cache of preferences.

---

## 9. Real-Time Updates (SSE)

Use liquidot_front's `use-sse.ts` hook, adapted to the real backend endpoint:

```typescript
// Endpoint: GET /api/positions/user/:userId/events
// Events: CREATED, EXECUTED, LIQUIDATED, FAILED, STATUS_CHANGE
// On event: invalidate React Query keys ["dashboard", userId], ["activities", userId]
```

- Reconnection logic from liquidot_front hook
- Only connect when authenticated (userId available)
- Disconnect on logout

---

## 10. Design System Migration

### 10.1 Design tokens (globals.css)

Adopt liquidot_front's complete token set:

```css
:root {
  /* Brand */
  --ld-primary: #0D6B58;
  --ld-accent: #00E5A0;
  --ld-warm: #F5A623;
  --ld-danger: #E53935;
  --ld-success: #00C853;
  --ld-polkadot-pink: #E6007A;

  /* Neutrals */
  --ld-dark: #0B1426;
  --ld-dark-mid: #12203A;
  --ld-light-1: #F8FAF9;
  --ld-light-2: #EFF3F2;
  --ld-white: #FFFFFF;
  --ld-ink: #1A2332;
  --ld-slate: #6B8299;
  --ld-frost: #E8ECF1;

  /* Spacing, radii, shadows — from liquidot_front globals.css */
}
```

### 10.2 Typography classes

From liquidot_front: `.text-display`, `.text-h2`, `.text-h3`, `.text-body-lg`, `.text-body`, `.text-caption`, `.text-eyebrow`, `.text-mono`

### 10.3 tailwind.config.ts

Minimal config — plugins only:

```typescript
export default {
  // No theme.extend.colors — all in CSS custom properties
  plugins: [
    // Add plugins as needed (typography, forms, etc.)
  ],
};
```

### 10.4 Dark mode

- **Not implemented in this phase.** Ship light-mode only.
- Future: add `[data-theme="dark"]` variant tokens to globals.css.
- Do not install next-themes or include theme toggle UI.

---

## 11. Component Migration

### 11.1 From liquidot_front (bring as-is, adapt where noted)

**Layout:**
- `layout-shell.tsx` — conditional rendering for landing vs app
- `navbar.tsx` — **adapt**: replace mock auth with Wagmi connect/SIWE
- `footer.tsx` — as-is
- `mobile-menu.tsx` — as-is
- `page-transition.tsx` — as-is

**Landing:**
- All 13 landing components (hero-section, hero-planet, trust-bar, problem-section, product-showcase, features-bento, how-it-works, architecture-section, chains-section, pools-preview, testimonials-section, cta-section, landing-footer)
- `lenis-provider.tsx` — landing page only

**Dashboard:**
- `portfolio-card.tsx` — **adapt**: wire to real dashboard API data
- `strategy-strip.tsx` — **adapt**: wire to real preferences
- `donut-chart.tsx` — **adapt**: wire to real pool allocations
- `positions-table.tsx` — **adapt**: wire to real positions, link rows to `/dashboard/positions/[id]`
- `activity-feed.tsx` — **adapt**: wire to real activity
- `chain-status.tsx` — **adapt**: wire to real chain connectivity (or mock initially)

**Pools:**
- `pool-table.tsx`, `filter-bar.tsx`, `pagination.tsx`, `stats-row.tsx`, `risk-score-bar.tsx` — **adapt**: wire to real `GET /api/pools`

**Position detail:**
- `position-hero.tsx`, `details-card.tsx`, `pnl-breakdown.tsx`, `position-timeline.tsx`, `transactions-card.tsx`, `range-visual.tsx` — **adapt**: wire to real `GET /api/positions/:id`

**Strategy:**
- All 8 strategy components (sidebar, presets, investment, ranges, pool-filters, safety, automation, advanced, form-field) — **adapt**: wire to real preferences API

**Settings:**
- `settings-sidebar.tsx`, `account-card.tsx`, `wallet-hero.tsx` — functional
- `connected-chains.tsx`, `notifications-card.tsx` — placeholder ("Coming Soon")
- `danger-zone.tsx` — wire to user delete endpoint if available

**Activity:**
- `activity-list.tsx`, `activity-filters.tsx`, `summary-strip.tsx` — **adapt**: wire to real activity API, client-side filtering

**Shared:**
- `dark-card.tsx`, `animated-counter.tsx`, `pnl-value.tsx`, `status-badge.tsx`, `token-pair-dots.tsx`, `explorer-link.tsx`, `page-skeleton.tsx`, `section-container.tsx`

**UI (shadcn):**
- Bring liquidot_front's set: button, card, input, label, badge, dialog, sheet, dropdown-menu, select, collapsible, scroll-area, separator, tooltip, chart
- Add more via `shadcn` CLI as needed during development

### 11.2 From existing Frontend (preserve functionality)

- **Wagmi config** (`lib/wagmi.ts`) — preserve but update chains to Asset Hub + Moonbeam
- **Contract ABIs** — preserve XCM Proxy ABI and ERC20 ABI, add AssetHubVault ABI
- **WalletConnect config** — preserve project ID setup

### 11.3 From existing Frontend (discard)

- All existing components in `components/` (replaced by liquidot_front equivalents)
- `context/wallet-context.tsx` — replaced by Zustand auth store
- `context/backend-user-context.tsx` — replaced by Zustand auth store
- `components/theme-provider.tsx` — no dark mode in this phase
- `styles/` directory — replaced by globals.css from liquidot_front
- `tailwind.config.ts` — replaced by minimal config + CSS tokens

---

## 12. Hooks

### 12.1 From liquidot_front (bring all)

| Hook | Purpose |
|------|---------|
| `use-sse.ts` | SSE connection with reconnection for position events |
| `use-reduced-motion.ts` | Respects `prefers-reduced-motion` for animations |
| `use-copy.ts` | Copy-to-clipboard with success state |

### 12.2 From existing Frontend (preserve if not duplicated)

| Hook | Purpose | Action |
|------|---------|--------|
| `useIsMobile` | Responsive breakpoint detection | Bring over if not in liquidot_front |
| `useDashboard` | Dashboard data fetching | **Adapt**: keep query logic, use in new dashboard components |
| `usePools` | Pool data fetching | **Replace**: use liquidot_front's query pattern |
| `usePositionEvents` | SSE position events | **Replace**: use liquidot_front's `use-sse.ts` |

---

## 13. Utilities

### 13.1 From liquidot_front

| File | Contents |
|------|----------|
| `lib/utils.ts` | `cn()` — clsx + tailwind-merge |
| `lib/utils/format.ts` | `formatUsd`, `formatDot`, `formatPercent`, `truncateHash`, `formatRelativeTime` |
| `lib/utils/explorer.ts` | Block explorer link generation |

### 13.2 From existing Frontend

| File | Action |
|------|--------|
| `lib/format.ts` | Merge any unique formatters into liquidot_front's `format.ts` |
| `lib/api.ts` | **Replace** with liquidot_front's `lib/api/` structure |

---

## 14. Types

Adopt liquidot_front's type system (`lib/types/`):
- `enums.ts` — PositionStatus, ActivityType, ActivityStatus
- `pool.ts` — PoolData, PoolsResponse
- `dashboard.ts` — DashboardUser, DashboardPosition, DashboardActivity, DashboardPool, DashboardSummary, DashboardData
- `position.ts` — PositionDetail, PositionPnL
- `activity.ts` — Activity
- `preferences.ts` — UserPreference

**Verify**: Ensure types match the actual backend DTOs. Adjust field names/types where the backend returns different shapes.

---

## 15. Environment Variables

```env
# API
NEXT_PUBLIC_API_URL=http://localhost:3001        # Backend URL
NEXT_PUBLIC_USE_MOCK=false                        # Mock data toggle (dev only)

# Wallet
NEXT_PUBLIC_WC_PROJECT_ID=                        # WalletConnect project ID

# Contracts
NEXT_PUBLIC_ASSETHUB_VAULT_ADDRESS=0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6
NEXT_PUBLIC_XCM_PROXY_ADDRESS=0x7f4b3620d6Ffcc15b11ca8679c57c076DCE109d1

# Chains
NEXT_PUBLIC_ASSETHUB_CHAIN_ID=420420422           # Paseo testnet
NEXT_PUBLIC_MOONBEAM_CHAIN_ID=1287                # Moonbase Alpha testnet
```

---

## 16. File Structure (Target)

```
Frontend/
├── app/
│   ├── layout.tsx                    # Root layout (fonts, providers)
│   ├── page.tsx                      # Landing page
│   ├── globals.css                   # Design tokens + typography + animations
│   ├── favicon.ico
│   ├── robots.ts
│   ├── sitemap.ts
│   ├── not-found.tsx
│   ├── error.tsx
│   ├── pools/
│   │   └── page.tsx                  # Pool explorer (hybrid auth)
│   ├── activity/
│   │   └── page.tsx                  # Activity history (auth required)
│   └── dashboard/
│       ├── layout.tsx                # Auth gate
│       ├── page.tsx                  # Dashboard home
│       ├── error.tsx
│       ├── strategy/
│       │   └── page.tsx              # Strategy config
│       ├── settings/
│       │   └── page.tsx              # User settings
│       └── positions/
│           └── [id]/
│               └── page.tsx          # Position detail
├── components/
│   ├── providers.tsx                 # React Query + Wagmi + Zustand hydration
│   ├── ui/                           # shadcn components
│   ├── layout/                       # navbar, footer, mobile-menu, layout-shell, page-transition
│   ├── landing/                      # 13 landing section components + lenis-provider
│   ├── dashboard/                    # portfolio-card, strategy-strip, donut-chart, etc.
│   ├── pools/                        # pool-table, filter-bar, pagination, stats-row, risk-score-bar
│   ├── position/                     # position-hero, details-card, pnl-breakdown, etc.
│   ├── strategy/                     # sidebar, presets, form sections
│   ├── settings/                     # sidebar, cards, danger-zone
│   ├── activity/                     # activity-list, filters, summary-strip
│   ├── shared/                       # dark-card, animated-counter, pnl-value, status-badge, etc.
│   └── wallet/                       # connect-button, deposit-form, withdraw-form (new)
├── lib/
│   ├── api/
│   │   ├── client.ts                 # Fetch wrapper with JWT injection
│   │   ├── pools.ts
│   │   ├── dashboard.ts
│   │   ├── positions.ts
│   │   ├── preferences.ts
│   │   ├── activity.ts
│   │   └── auth.ts                   # SIWE auth endpoints (new)
│   ├── store/
│   │   ├── auth-store.ts             # Zustand: JWT + wallet + userId
│   │   └── ui-store.ts              # Zustand: mobile menu, etc.
│   ├── types/
│   │   ├── enums.ts
│   │   ├── pool.ts
│   │   ├── dashboard.ts
│   │   ├── position.ts
│   │   ├── activity.ts
│   │   └── preferences.ts
│   ├── mock/                         # Dev fallback data (all entities)
│   ├── hooks/
│   │   ├── use-sse.ts
│   │   ├── use-reduced-motion.ts
│   │   ├── use-copy.ts
│   │   └── use-mobile.ts
│   ├── utils/
│   │   ├── format.ts
│   │   └── explorer.ts
│   ├── utils.ts                      # cn() helper
│   ├── wagmi.ts                      # Wagmi config (Asset Hub + Moonbeam chains)
│   └── contracts/
│       ├── assethub-vault-abi.ts      # AssetHubVault ABI
│       ├── xcm-proxy-abi.ts           # XCMProxy ABI
│       └── erc20-abi.ts               # ERC20 ABI
├── .storybook/
│   ├── main.ts
│   └── preview.ts
├── public/
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts                # Minimal — plugins only
├── tsconfig.json
├── components.json                   # shadcn config
├── package.json
└── .env.local
```

---

## 17. Migration Steps (Ordered)

### Phase 0: Branch setup
1. Create `feat/frontend-v2` branch from `main`
2. Back up existing `Frontend/` contents

### Phase 1: Foundation
3. Replace `package.json` with liquidot_front deps + Wagmi + Viem + SIWE deps
4. Switch to npm, generate `package-lock.json`
5. Copy `next.config.ts`, `postcss.config.mjs`, `tsconfig.json` from liquidot_front
6. Create minimal `tailwind.config.ts` (plugins only)
7. Copy `globals.css` with all design tokens
8. Copy `components.json` (shadcn config)
9. Copy all `components/ui/` from liquidot_front
10. Copy `lib/utils.ts`, `lib/utils/`
11. Verify: `npm run dev` starts without errors

### Phase 2: Layout & navigation
12. Copy `components/layout/` from liquidot_front
13. Copy `components/providers.tsx`, adapt to include Wagmi provider
14. Set up Zustand stores (`auth-store.ts`, `ui-store.ts`)
15. Set up Wagmi config with Asset Hub + Moonbeam chains
16. Adapt navbar: replace mock auth with Wagmi connect + SIWE flow
17. Copy `app/layout.tsx`, adapt font imports and providers
18. Verify: app renders with navbar, wallet connect works

### Phase 3: Landing page
19. Copy all `components/landing/` from liquidot_front
20. Copy `app/page.tsx` (landing)
21. Copy `lenis-provider.tsx`
22. Verify: landing page renders with 3D hero, all sections

### Phase 4: API layer
23. Copy `lib/api/` from liquidot_front
24. Adapt `client.ts`: add JWT from Zustand, set `BASE_URL` to backend
25. Create `lib/api/auth.ts` for SIWE endpoints
26. Copy `lib/types/` from liquidot_front
27. Copy `lib/mock/` for dev fallback
28. Verify: API calls work against running backend

### Phase 5: Pools page
29. Copy `components/pools/` from liquidot_front
30. Copy `app/pools/page.tsx`
31. Adapt `getPools()` to use backend params (remove unsupported, add client-side sort/chain/dex)
32. Add hybrid auth: "Invest" buttons check wallet connection
33. Verify: pools page loads with real data from backend

### Phase 6: Dashboard
34. Copy `components/dashboard/` from liquidot_front
35. Copy `app/dashboard/layout.tsx` and `page.tsx`
36. Wire components to existing `GET /api/dashboard/:userId` response
37. Adapt data mapping where liquidot_front types differ from backend response
38. Wire SSE via `use-sse.ts` hook
39. Verify: dashboard shows real user data

### Phase 7: Strategy page
40. Copy `components/strategy/` from liquidot_front
41. Copy `app/dashboard/strategy/page.tsx`
42. Wire form to `GET/PATCH /api/preferences/:userId`
43. Add "Preview" button → `POST /api/investmentDecisions`
44. Add "Run Now" button → trigger execution
45. Verify: preferences save and load correctly

### Phase 8: Position detail
46. Copy `components/position/` from liquidot_front
47. Copy `app/dashboard/positions/[id]/page.tsx`
48. Wire to `GET /api/positions/:id` and `GET /api/positions/:id/pnl`
49. Verify: position detail loads with real data

### Phase 9: Activity & Settings
50. Copy `components/activity/` from liquidot_front
51. Copy `app/activity/page.tsx`
52. Wire to `GET /api/users/:userId/activity`, client-side filtering
53. Copy `components/settings/` from liquidot_front
54. Copy `app/dashboard/settings/page.tsx`
55. Wire functional sections, add "Coming Soon" to unsupported
56. Verify: both pages render

### Phase 10: Deposit/Withdraw
57. Create new `components/wallet/` with deposit and withdraw forms
58. Design in liquidot_front visual language
59. Wire to AssetHubVault contract via Wagmi `useWriteContract`
60. Add to dashboard (or as modal accessible from navbar)
61. Verify: deposit flow works on testnet

### Phase 11: Shared components & hooks
62. Copy `components/shared/` from liquidot_front
63. Copy `lib/hooks/` from liquidot_front
64. Copy contract ABIs to `lib/contracts/`
65. Verify: all shared components render correctly

### Phase 12: Storybook
66. Copy `.storybook/` config from liquidot_front
67. Copy all `*.stories.tsx` files
68. Verify: `npm run storybook` launches

### Phase 13: Cleanup & QA
69. Remove any unused files from existing Frontend
70. Run `npm run lint` and fix issues
71. Run `npm run build` — ensure production build succeeds
72. Test all pages end-to-end against running backend
73. Test wallet connect/disconnect flow
74. Test deposit flow on testnet
75. Verify mobile responsiveness on all pages

---

## 18. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Wagmi compatibility with Next.js 16 | Test early in Phase 1. If issues, pin to compatible Wagmi version. |
| Tailwind v3→v4 migration breaks existing components | We're replacing components, not migrating them. Risk is limited to any carried-over code. |
| Backend response shapes don't match liquidot_front types | Phase 4: verify types against actual backend responses. Adapt as needed. |
| Three.js bundle size | Dynamic import with `next/dynamic`. Verify via bundle analyzer. |
| SIWE flow complexity | Use established `siwe` npm package. Test against backend auth endpoint early. |
| Lenis scroll conflicts on app pages | Lenis is strictly landing-page only. App pages use native scroll. |

---

## 19. Out of Scope (Future)

- Dark mode theme variants
- Playwright visual regression tests
- Docker / deployment updates
- Backend API enhancements (sort/chain/dex filters, activity filters)
- Notification system (settings page placeholder)
- Connected chains management (settings page placeholder)
- Multi-chain deposit support (Asset Hub only for now)
- Position NFT display
- Governance/DAO UI
