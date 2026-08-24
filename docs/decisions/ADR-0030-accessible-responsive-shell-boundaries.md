# ADR 0030 — Accessible responsive shell boundaries

- Status: Accepted
- Date: 2026-08-24
- Work package: WP 5.18

## Context

The merchant portal, store operations center and platform console now expose server-authorized product workflows, but their navigation shells were assembled at different times. The desktop layouts are usable, while narrow screens retain oversized vertical navigation in merchant areas and hide the platform exit/logout controls with the desktop sidebar. Keyboard users also lack a consistent way to bypass repeated navigation and a global visible-focus guarantee.

## Decision

- Every authenticated product shell exposes a first-focus skip link targeting its unique main-content landmark.
- The target is a semantic `main` with a stable ID and programmatic focus support.
- Desktop and narrow-screen navigation are projections of the same route/capability model; neither copy invents authorization or state.
- Narrow-screen primary navigation is compact and horizontally scrollable instead of consuming the first viewport as a long vertical menu.
- The active route uses `aria-current="page"`; disabled server-authorized modules remain disabled and are not simulated as links.
- Platform exit and logout remain reachable on narrow screens even when the desktop identity sidebar is hidden.
- A global `:focus-visible` treatment provides a visible keyboard indicator without altering pointer focus behavior.

## Consequences

- The current merchant and platform tasks remain reachable at 360 CSS pixels without removing desktop navigation.
- Keyboard users can reach the current task directly and identify the active destination.
- Responsive markup may contain desktop and mobile projections simultaneously; CSS owns visibility while callbacks and permission inputs remain shared.
- No API, database, session, policy, tenant or commerce contract changes.

## Rollback

Restore the previous web image. No backend or data rollback is required.
