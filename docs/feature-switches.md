# Feature switches (Admin → Features)

The Super Admin can switch parts of CRAFT off, or back on, for:
- everyone;
- an organisation type (archetype);
- a country;
- a network;
- one organisation;
- one user.

Switching a feature off never deletes data.

## Rules (`src/lib/features.ts`, `decide()`)

1. **Off for everyone is a kill switch.** It wins over every other setting.
2. Otherwise **the most specific setting wins**: user, then organisation, network, country, organisation type, everyone.
3. When an organisation's **networks disagree, off wins**.
4. With no setting, a feature is on. Settings with a past "until" date are ignored.

The Super Admin always keeps every feature, so they can't lock themselves out. **Check as** shows what any user or
organisation sees, and which setting decided it.

Each setting needs a reason, which people see when the feature is off. Every change goes to the audit log.

## What gets switched

The registry is `FEATURES` in `src/lib/features.ts`. Each feature lists the app routes and the API paths it owns.

- **Server:** every function runs through `monitored()` (`netlify/lib/monitoring.ts`). For any API path a feature owns,
  it calls `featureBlock()` (`netlify/lib/feature-gate.ts`), which refuses the request with
  `403 { error: 'feature_off', message }`.
- **App:** off features drop out of the sidebar. Their pages show "… is switched off" with the reason, and the support
  assistant hides. The app reads `GET /api/features`; signed-out visitors only see settings for everyone.
- **Timing:** settings are cached for a minute per function instance, so a change reaches everyone within a minute.
- **Screens only:** features with no API of their own (for example narrative report, quantified risk, ISSB) work in the
  browser. For those, switching off hides the screens only.
- **Never switchable:** sign-in, dashboard, settings and team, privacy and data rights, the audit log, help, Admin, and
  the public verification page.

Organisation type and country match the values stored on each organisation (case-insensitive). Admin offers only
values that are actually in use.
