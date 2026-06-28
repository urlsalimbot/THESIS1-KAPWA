# Phase 09: Landing Page & Auth Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 09-landing-page-auth-flow
**Areas discussed:** Landing page structure, Public page layout, Role-aware redirect, Claimant registration, Branding & content

---

## Landing Page Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single-page with sections | All content on one scrollable page | |
| Multi-page | Separate routes for landing, about, contact | ✓ |

**User's choice:** Multi-page
**Notes:** Decided on three pages: Landing (hero, services, steps), About (mission, team, programs), Contact (simple form)

| Option | Description | Selected |
|--------|-------------|----------|
| Landing + About only | Just two public pages | |
| Add a Contact page | Separate /contact route with form | ✓ |
| Add a Programs/Services page | Detailed program listing | |

**User's choice:** Add a Contact page with simple form

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky top nav bar | Fixed header with nav links + Login | |
| Minimal nav with just Login | Login CTA only | ✓ |

**User's choice:** Minimal nav with Login button only

| Option | Description | Selected |
|--------|-------------|----------|
| Simple contact form | Name, email, message fields | ✓ |
| Details only | Just address, phone, email | |

**User's choice:** Simple contact form

| Option | Description | Selected |
|--------|-------------|----------|
| Tagline + CTA | 'Social Welfare, Simplified' style | |
| Mission statement | MSWDO mission as headline | ✓ |

**User's choice:** Mission statement as hero focus

| Option | Description | Selected |
|--------|-------------|----------|
| Card grid | shadcn Card components for services | ✓ |
| Simple list | Unordered list of services | |

**User's choice:** Card grid for services overview

| Option | Description | Selected |
|--------|-------------|----------|
| Numbered timeline/steps | Step indicators for application process | ✓ |
| Simple paragraph description | Short text describing the process | |

**User's choice:** Numbered timeline for application steps

| Option | Description | Selected |
|--------|-------------|----------|
| Generic officer listing | Position placeholders for team | ✓ |
| Org chart / hierarchy | Simple org chart structure | |
| Skip team section | No team section on about page | |

**User's choice:** Generic officer listing for team section

---

## Public Page Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Public header + footer | Shared PublicLayout shell | ✓ |
| Standalone pages | Each page self-contained | |

**User's choice:** Shared PublicLayout shell

| Option | Description | Selected |
|--------|-------------|----------|
| Same public layout | Login page uses PublicLayout too | ✓ |
| Standalone (as currently) | Login remains standalone | |

**User's choice:** Login page uses same public layout

| Option | Description | Selected |
|--------|-------------|----------|
| Logo + nav links + Login | Full header | ✓ |
| Logo + Login only | Minimal header | |

**User's choice:** Logo + nav links (Home, About, Contact) + Login

| Option | Description | Selected |
|--------|-------------|----------|
| Standard gov footer | LGU branding, links, contact, copyright | ✓ |
| Minimal footer | Just copyright and LGU link | |

**User's choice:** Standard government footer

---

## Role-Aware Redirect

| Option | Description | Selected |
|--------|-------------|----------|
| Use existing route structure | Direct role-to-route mapping | ✓ |
| All staff to dashboard | Unified dashboard for staff roles | |

**User's choice:** Direct role-to-route mapping: social_worker→/, admin→/admin, coordinator→/coordinator, claimant→/my-dashboard, mayor→/reports, auditor→/audit-logs

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to their dashboard | Logged-in users redirected away from landing | |
| Show landing with nav change | Login button becomes 'Go to Dashboard' | ✓ |

**User's choice:** Logged-in users see landing page with nav change

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to /unauthorized | Dedicated unauthorized page | |
| Redirect to their dashboard | Silent redirect to own role's page | ✓ |

**User's choice:** Unauthorized access redirects to own dashboard

---

## Claimant Self-Registration

| Option | Description | Selected |
|--------|-------------|----------|
| Link below the form | 'Register as claimant' link | ✓ |
| Tab/switch on login | Login page with Sign In / Register tabs | |
| Separate /register route | Dedicated registration page | |

**User's choice:** 'Register as claimant' link below login form

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal fields | Name, email, password, barangay | |
| Standard fields | Name, email, phone, password, confirm, barangay, DOB | ✓ |

**User's choice:** Standard field set (full name, email, phone, password, confirm password, barangay, date of birth)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-login to claimant dashboard | Frictionless onboarding | ✓ |
| Success message + redirect to login | Manual sign-in after registration | |

**User's choice:** Auto-login + redirect to /my-dashboard

---

## Branding & Content

| Option | Description | Selected |
|--------|-------------|----------|
| Create placeholder content | Professional placeholder text | ✓ |
| I have existing materials | Real MSWDO content provided | |

**User's choice:** Create placeholder content (replaceable later)

| Option | Description | Selected |
|--------|-------------|----------|
| Same design tokens | Consistent brand identity | ✓ |
| Distinct public palette | Different colors for public pages | |

**User's choice:** Same design tokens as Phase 7

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder LGU logo | 'MSWDO Norzagaray' placeholder | ✓ |
| No logo | Just Kapwa brandmark | |

**User's choice:** Placeholder LGU logo/branding

---

## the agent's Discretion

- Exact hero/mission wording for the landing page (professional placeholder)
- Contact form implementation (simple API endpoint or client-side only)
- Visual design details within token constraints
- Registration form validation rules
- Login page shadcn migration specifics (replacing legacy classes with shadcn Input, Button, Card)

## Deferred Ideas

None — discussion stayed within phase scope
