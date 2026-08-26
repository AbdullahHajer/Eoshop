# ADR 0033 — Public storefront accessibility and narrow-screen boundary

## Status

Accepted for WP 5.21 on 2026-08-26.

## Context

The public storefront completes the server-authoritative customer journey, but its inherited renderer did not define a complete keyboard, focus, reduced-motion or narrow-screen contract. The cart looked like a drawer without modal semantics, checkout errors did not move focus, custom merchant colors could produce unreadable foregrounds and a failed bootstrap could end in a blank render. These defects must be corrected without reopening tenant, catalog, pricing, inventory or order authority.

## Decision

1. Public bootstrap always renders an explicit loading, ready or safe retryable error state; a terminal blank render is forbidden.
2. The loaded document exposes a skip link and one focusable main landmark.
3. The cart is a true modal dialog: initial focus, focus containment, Escape dismissal, background scroll lock and deterministic focus restoration are required. Continuing to checkout moves focus into checkout instead of restoring it behind the new page.
4. Navigation, brand actions, category state, product actions, payment choices and checkout errors expose native or equivalent accessible semantics.
5. Server rejection preserves the customer's entered checkout data and focuses a retryable alert. Successful checkout moves focus to the immutable server receipt.
6. Storefront motion honors `prefers-reduced-motion`; the mobile dock honors safe-area insets and controls remain reachable at narrow widths.
7. Merchant-selected colors use a shared relative-luminance foreground chooser. This changes presentation only and never rewrites persisted merchant settings.

## Consequences

- Keyboard and assistive-technology users receive predictable focus and status behavior across the public purchase path.
- The storefront remains usable at 320–390 CSS pixels without changing the server-owned storefront contract.
- Platform settings and storefront components share one readable-foreground rule.
- No API, database, tenant-isolation, authorization, pricing, inventory or order contract changes.
- Full browser/device rendering remains a Pilot acceptance activity; automated component tests prove the structural contract but do not claim physical browser coverage.

