# CRAFT launch marketing kit

Launch date: **Monday, 12 October 2026** · Contact: craftframework@becomechange.institute

The public press kit lives at **https://craftframework.becomechange.institute/launch**. This folder holds the
sources behind it.

| Path | What it is |
| --- | --- |
| `src/lib/launch.ts` | Single source for all launch copy (key messages, social posts, email, press release, boilerplate). Used by the `/launch` page and the copy deck. |
| `marketing/launch-copy.md` | Generated copy deck for sharing outside the site. |
| `marketing/brand-guidelines.md` | Logo, colour, typography and usage rules. |
| `marketing/launch-plan.md` | Posting schedule for launch week. |
| `marketing/scripts/build-assets.mjs` | Generates every graphic (SVG + PNG), the copy deck and `craft-launch-kit.zip` into `public/launch/`. |

## Regenerating assets

```bash
node marketing/scripts/build-assets.mjs
```

Requires Node 22.18+, `rsvg-convert` and `zip`. Install Playfair Display, Inter and JetBrains Mono locally
before rendering so the PNGs use the brand fonts (otherwise the renderer falls back to system fonts).

## Asset list (`public/launch/`)

| File | Size | Use |
| --- | --- | --- |
| `craft-launch-1200x627` | 1200×627 | LinkedIn / Facebook feed & link share |
| `craft-launch-1600x900` | 1600×900 | X post, slides |
| `craft-save-the-date-1080x1080` | 1080×1080 | Teaser (T-3 days) |
| `craft-now-live-1080x1080` | 1080×1080 | Launch day |
| `craft-paper-compliance-1080x1080` | 1080×1080 | Post-launch key message |
| `craft-launch-story-1080x1920` | 1080×1920 | Instagram / Facebook / WhatsApp story |
| `craft-linkedin-banner-1584x396` | 1584×396 | LinkedIn cover |
| `craft-x-header-1500x500` | 1500×500 | X profile header |
| `craft-email-header-1200x400` | 1200×400 | Launch email / newsletter |
| `craft-lockup-light-bg`, `craft-lockup-dark-bg` | 880×360 | Horizontal logo lockups |
| `craft-mark`, `craft-mark-mono-white` | 1024×1024 | Shield mark (full colour / single colour) |
