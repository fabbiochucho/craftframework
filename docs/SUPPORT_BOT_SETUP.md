# Support Bot Setup Guide

This guide walks you through setting up the lightweight support bot and issue-routing layer for craftframework.

## Overview

The support bot provides:

- **Question answering** from a knowledge base
- **Request classification** (bug, feature, question)
- **Automatic GitHub issue creation** for bugs and features
- **Email notification** to `craftframework@becomechange.institute`
- **Chat widget** for easy user access

## Architecture

### Components

1. **Netlify Function** (`netlify/functions/support-bot.ts`)
   - Receives POST requests from the chat widget
   - Classifies requests
   - Answers common questions from knowledge base
   - Creates GitHub issues
   - Sends email notifications

2. **Chat Widget** (`src/components/SupportBot.tsx`)
   - React component embedded on docs/support pages
   - Collects user email (optional)
   - Displays bot responses
   - Shows links to created issues

## Setup Steps

### 1. Create GitHub Token

1. Go to [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a name like `craftframework-support-bot`
4. Grant these scopes:
   - `repo` (full control of private repositories)
   - `issues` (read/write issues)
5. Click "Generate token"
6. Copy the token (you won't see it again)

### 2. Set Up SendGrid (for email notifications)

1. Sign up for a free SendGrid account at [sendgrid.com](https://sendgrid.com)
2. Go to Settings → API Keys
3. Create a new API Key
4. Copy the key
5. Also create a sender email:
   - Go to Settings → Sender Authentication
   - Verify a domain or single sender email
   - Use an email like `noreply@craftframework.becomechange.institute`

### 3. Add Environment Variables to Netlify

1. Go to your Netlify site settings
2. Navigate to **Site Settings → Build & Deploy → Environment**
3. Add the following environment variables:

```
GITHUB_TOKEN=your_github_token_here
SENDGRID_API_KEY=your_sendgrid_key_here
SUPPORT_EMAIL=craftframework@becomechange.institute
SENDGRID_FROM_EMAIL=noreply@craftframework.becomechange.institute
```

### 4. For Local Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your tokens:
   ```
   GITHUB_TOKEN=your_token
   SENDGRID_API_KEY=your_key
   SUPPORT_EMAIL=craftframework@becomechange.institute
   SENDGRID_FROM_EMAIL=noreply@craftframework.becomechange.institute
   ```

3. Restart your dev server:
   ```bash
   netlify dev --port 8889
   ```

## Integrating the Chat Widget

### Option 1: In Your Layout

Add the `SupportBot` component to your main layout:

```tsx
import { SupportBot } from "./components/SupportBot";

export default function RootLayout() {
  return (
    <>
      {/* Your existing layout */}
      <SupportBot />
    </>
  );
}
```

### Option 2: On Specific Pages

Import and use on specific pages (e.g., docs, support page):

```tsx
import { SupportBot } from "../components/SupportBot";

export default function DocsPage() {
  return (
    <div>
      <h1>Documentation</h1>
      {/* Your content */}
      <SupportBot />
    </div>
  );
}
```

## Customizing the Knowledge Base

Edit `netlify/functions/support-bot.ts` and update the `KNOWLEDGE_BASE` array:

```typescript
const KNOWLEDGE_BASE = [
  {
    keywords: ["your", "keywords"],
    answer: `Your answer here`,
  },
  // Add more entries...
];
```

### Adding FAQ Entries

```typescript
{
  keywords: ["deployment", "netlify", "production"],
  answer: `## How to Deploy

Steps here...
  `,
}
```

Keywords are case-insensitive and partial matches work.

## Testing

### Local Testing

1. Start the dev server:
   ```bash
   netlify dev --port 8889
   ```

2. Open the app and look for the chat widget in the bottom-right corner

3. Try these test messages:
   - "How do I set up?"
   - "The dashboard crashes when I load it" (creates a bug issue)
   - "Can you add PDF export?" (creates a feature request)

### Manual Issue Creation Test

Test the GitHub API by sending a curl request:

```bash
curl -X POST http://localhost:8889/.netlify/functions/support-bot \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test: Dashboard crashes on load",
    "email": "test@example.com",
    "context": "/dashboard"
  }'
```

Expect a response:
```json
{
  "success": true,
  "type": "bug",
  "issueCreated": true,
  "issueUrl": "https://github.com/fabbiochucho/craftframework/issues/123",
  "emailSent": true,
  "message": "Your bug has been recorded. [Track it here](...)"
}
```

## Monitoring

### GitHub Issues

Check the repository for issues labeled `bot-generated`, `bug`, or `feature` to see incoming requests.

### Email

Monitor the support email inbox at `craftframework@becomechange.institute` for all forwarded requests.

### Netlify Logs

View function logs in Netlify:
1. Go to your site → Functions
2. Click `support-bot`
3. Check execution logs

## Troubleshooting

### No response from the bot

1. Check that environment variables are set on Netlify
2. Verify the function deployed: `netlify dev` or Netlify dashboard
3. Check browser console for errors

### Issues not created

1. Verify `GITHUB_TOKEN` has `repo` and `issues` scopes
2. Check Netlify function logs
3. Ensure the token hasn't expired

### Emails not sending

1. Verify `SENDGRID_API_KEY` is correct
2. Check that sender email is verified in SendGrid
3. Look for bounce/delivery issues in SendGrid dashboard

## Customization Ideas

- Add language support (translations for bot responses)
- Integrate with Slack for urgent issues
- Add sentiment analysis for priority routing
- Connect to analytics to track common questions
- Add FAQ tags or categories for better routing
- Set up automatic label assignment based on classification

## Next Steps

1. Deploy to Netlify
2. Monitor for a week
3. Gather feedback
4. Refine knowledge base based on common questions
5. Adjust classification thresholds if needed

## Support

For questions about the support bot setup, contact the maintainers:

craftframework@becomechange.institute
