# Backlink & Off-Site SEO/GEO Strategy

This is a plan for you (or whoever owns marketing/comms) to execute — inbound links and third-party citations
have to come from real external sites and real outreach; there's no code change that creates them.

## Why this matters here specifically

CRAFT and the Institute both currently have close to zero external citations. For traditional SEO, that means
low domain authority regardless of how clean the on-page technical SEO is (which is now fixed — see the git
history on both repos). For GEO (how LLM-based search like Perplexity/ChatGPT answer "what tools exist for
institutional readiness assessment"), it's worse: an LLM has no way to verify a claim it can only find on the
claimant's own site, so single-source content gets filtered out or treated as unverified.

## Priority 1 — Free, high-authority platform citations (do these first)

These are the platforms GEO tooling (Perplexity, ChatGPT search) and traditional SEO both trust as
independent verification, and they cost nothing but setup time:

- **GitHub**: craftframework's repo — if it's ever made public (it's currently private), a public repo with a
  real README describing the CRAFT framework is a strong, free citation. Consider open-sourcing the
  methodology repo (the ToS already states the software is GPL-3.0 and methodology CC BY-SA 4.0 — the license
  choice already assumes public visibility that hasn't happened yet).
- **Product Hunt**: launch CRAFT there once the Vercel migration is stable. Free, one-time, and Perplexity
  crawls PH data specifically.
- **Crunchbase**: create an organization profile for the DiBadili Institute / Become Change Institute — this
  is one of the sources GEO tools weight most heavily for "what is this company/product."
- **LinkedIn Company Page**: confirm one exists and is linked from both sites' footers (it already is, per
  BRAND.socials) — keep it active with real posts, since a dormant page is a weak signal.
- **G2 / Capterra**: relevant if CRAFT is positioned as a SaaS product for institutions rather than purely a
  nonprofit tool — worth a listing either way, since it's free and G2 is a named GEO trust source.

## Priority 2 — Content that earns links naturally

Directly copying the "Information Gain" principle: links come to pages with something nobody else has.

- Publish the actual **methodology** as a standalone, citable document (a whitepaper or long-form article),
  not only as in-app UI copy — right now the CRAFT methodology only exists behind the `/methodology` page's
  UI, which is thin content for a crawler to cite as an authoritative source.
- Publish **anonymized aggregate findings** from real assessments once you have enough data (e.g., "73% of
  assessed West African NGOs lack a documented fiduciary control for X") — this is exactly the kind of unique,
  data-backed content GEO and traditional SEO both reward, and it's the one thing competitors can't just
  publish, since it's your own users' data.
- A **case study** page per major partner/client, once you have client permission — these are the single
  highest-conversion backlink-attracting content type for B2B tools.

## Priority 3 — Manual outreach (ongoing, not one-time)

- Identify 10–15 African development/governance publications, newsletters, or podcasts and pitch a guest
  piece or interview about institutional readiness in the sector — each one is a real, earned backlink plus a
  GEO citation.
- Answer relevant questions on Reddit (r/nonprofit, r/development, African-development-focused subreddits)
  and Stack Exchange where CRAFT/DiBadili is a genuinely useful pointer — GEO tools crawl these heavily for
  "real user opinion" signals, per the GEO framework you were given.
- Reach out to any donor/DFI partners already using the platform and ask for a public testimonial or
  case-study co-publication — a DFI or ministry's own site linking to CRAFT is a very high-authority backlink.

## What "done" looks like

There's no single completion state — this is an ongoing program. A reasonable 90-day check-in target:
GitHub repo public + Crunchbase profile live + 1 methodology whitepaper published + 3 outreach placements.
