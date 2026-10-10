import { Handler } from "@netlify/functions";

/**
 * Support Bot Handler
 *
 * Processes incoming support requests, classifies them, answers common questions,
 * creates GitHub issues for bugs/features, and forwards to email.
 *
 * Expected POST body:
 * {
 *   "message": "User's question or report",
 *   "email": "user@example.com" (optional),
 *   "context": "page or feature context" (optional)
 * }
 */

interface SupportRequest {
  message: string;
  email?: string;
  context?: string;
  timestamp?: string;
}

interface ClassifiedRequest {
  type: "question" | "bug" | "feature" | "other";
  confidence: number;
  summary: string;
  urgency: "high" | "medium" | "low";
}

interface BotResponse {
  success: boolean;
  type?: string;
  answer?: string;
  issueCreated?: boolean;
  issueUrl?: string;
  emailSent?: boolean;
  message: string;
}

// Knowledge base for common questions
const KNOWLEDGE_BASE = [
  {
    keywords: ["setup", "install", "get started", "local", "run"],
    answer: `## Getting Started with craftframework

**Quick Setup:**
\`\`\`bash
npm install
npm run dev
\`\`\`

For local development, the project uses Netlify CLI:
\`\`\`bash
netlify dev --port 8889
\`\`\`

**Requirements:**
- Node.js 18+
- npm
- Git

For detailed setup instructions, see the [README.md](https://github.com/fabbiochucho/craftframework#running-locally).
    `,
  },
  {
    keywords: ["authentication", "auth", "login", "credentials"],
    answer: `## Authentication

The demo environment allows you to sign in with any credentials for testing purposes.

**In production**, authentication is handled via secure session management. For specific auth configuration questions, please open a [GitHub discussion](https://github.com/fabbiochucho/craftframework/discussions) or contact the maintainers.

**Auth routes:**
- \`/auth\` — Login & Quick Registration
- \`/dashboard\` — Authenticated organization view
    `,
  },
  {
    keywords: ["roles", "permissions", "access", "admin"],
    answer: `## Roles and Access Control

The toolkit supports multiple roles:
- **Assessor** — Single-org view (National Public Health Agency)
- **Super Admin** — Multi-org aggregate view with heatmaps

In the demo, use the **role switcher** in the sidebar to toggle between roles.

For production role and permission configuration, see the CONTRIBUTING guide or contact us.
    `,
  },
  {
    keywords: ["assessment", "scoring", "evaluation", "wizard"],
    answer: `## Assessment & Scoring

The toolkit provides a **5-Tier structured evaluation** across 19 domains:
- Governance
- Fiduciary
- Grant Management
- USG Compliance
- Digital Readiness

**The assessment wizard includes:**
- 0–5 sliders for scoring
- Evidence upload
- Live risk badge updates
- Automated Capacity Development Plan (CIP) from low-scoring items

Access the assessment at \`/assessment\` after login.
    `,
  },
  {
    keywords: ["export", "report", "download", "pdf"],
    answer: `## Reports and Export

The dashboard provides real-time visualization of assessment results. For custom export or report generation, please open a [feature request](https://github.com/fabbiochucho/craftframework/issues/new?template=feature_request.yml).
    `,
  },
  {
    keywords: ["deployment", "deploy", "netlify", "production"],
    answer: `## Deployment

The project is designed for **Netlify deployment**. Configuration is handled via \`netlify.toml\`.

**To deploy:**
1. Connect your repository to Netlify
2. Use default build settings (managed by netlify.toml)
3. Deploy

For deployment issues or custom configuration, see the [CONTRIBUTING.md](https://github.com/fabbiochucho/craftframework/blob/main/CONTRIBUTING.md) or contact us.
    `,
  },
  {
    keywords: ["standards", "compliance", "usaid", "requirements"],
    answer: `## Standards & Compliance

The toolkit aligns with:
- **USAID** (2 CFR 200)
- **Global Fund** FMS
- **World Bank** standards
- **PEPFAR/CDC** guidelines
- **WHO** IHR

For detailed compliance documentation, check the project repository or contact the maintainers.
    `,
  },
  {
    keywords: ["tech stack", "technology", "framework", "react"],
    answer: `## Tech Stack

- **Framework**: TanStack Start (React 19, SSR-capable)
- **Routing**: TanStack Router (file-based)
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts (Radar, Bar, Pie/Gauge)
- **Icons**: Lucide React
- **State**: React Context API
- **Deployment**: Netlify
    `,
  },
];

// Classify the incoming request
function classifyRequest(message: string): ClassifiedRequest {
  const lowerMessage = message.toLowerCase();

  // Bug indicators
  const bugKeywords = [
    "error",
    "crash",
    "bug",
    "broken",
    "doesn't work",
    "fail",
    "not working",
    "issue",
    "problem",
  ];
  const isBug = bugKeywords.some((kw) => lowerMessage.includes(kw));

  // Feature indicators
  const featureKeywords = [
    "add",
    "feature",
    "enhancement",
    "capability",
    "would like",
    "can we",
    "please add",
    "support",
    "export",
  ];
  const isFeature = featureKeywords.some((kw) => lowerMessage.includes(kw));

  // Urgency indicators
  const urgentKeywords = ["urgent", "critical", "blocking", "asap", "immediate"];
  const isUrgent = urgentKeywords.some((kw) => lowerMessage.includes(kw));

  if (isBug) {
    return {
      type: "bug",
      confidence: 0.85,
      summary: message.substring(0, 100),
      urgency: isUrgent ? "high" : "medium",
    };
  }

  if (isFeature) {
    return {
      type: "feature",
      confidence: 0.8,
      summary: message.substring(0, 100),
      urgency: "low",
    };
  }

  return {
    type: "question",
    confidence: 0.9,
    summary: message.substring(0, 100),
    urgency: isUrgent ? "high" : "low",
  };
}

// Find answer from knowledge base
function findAnswer(message: string): string | null {
  const lowerMessage = message.toLowerCase();

  for (const entry of KNOWLEDGE_BASE) {
    if (entry.keywords.some((kw) => lowerMessage.includes(kw))) {
      return entry.answer;
    }
  }

  return null;
}

// Create GitHub issue via GitHub API
async function createGitHubIssue(
  classification: ClassifiedRequest,
  userEmail?: string
): Promise<{ success: boolean; url?: string }> {
  const token = process.env.GITHUB_TOKEN;
  const owner = "fabbiochucho";
  const repo = "craftframework";

  if (!token) {
    console.error("GITHUB_TOKEN not set");
    return { success: false };
  }

  const labels = [classification.type];
  if (classification.urgency === "high") labels.push("urgent");

  const body = `**Type:** ${classification.type}\n**Urgency:** ${classification.urgency}\n**User Email:** ${userEmail || "not provided"}\n\n---\n\n${classification.summary}`;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: classification.summary.substring(0, 70),
          body,
          labels,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return { success: true, url: data.html_url };
    }

    console.error("GitHub API error:", response.status, await response.text());
    return { success: false };
  } catch (error) {
    console.error("Error creating GitHub issue:", error);
    return { success: false };
  }
}

// Send email notification
async function sendEmailNotification(
  request: SupportRequest,
  classification: ClassifiedRequest,
  issueUrl?: string
): Promise<boolean> {
  const toEmail = process.env.SUPPORT_EMAIL || "craftframework@becomechange.institute";
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@craftframework.becomechange.institute";
  const sendgridKey = process.env.SENDGRID_API_KEY;

  if (!sendgridKey) {
    console.warn("SENDGRID_API_KEY not set; email notification skipped");
    return false;
  }

  const emailBody = `
New Support Request (${classification.type})

From: ${request.email || "anonymous"}
Type: ${classification.type}
Urgency: ${classification.urgency}
Context: ${request.context || "none provided"}

Message:
${request.message}

---
${issueUrl ? `GitHub Issue: ${issueUrl}` : "No issue created."}
  `.trim();

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [
              {
                email: toEmail,
              },
            ],
          },
        ],
        from: {
          email: fromEmail,
          name: "craftframework Support",
        },
        subject: `[${classification.type.toUpperCase()}] ${classification.summary.substring(0, 50)}`,
        content: [
          {
            type: "text/plain",
            value: emailBody,
          },
        ],
      }),
    });

    if (response.ok) {
      return true;
    }

    console.error("SendGrid error:", response.status, await response.text());
    return false;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const request: SupportRequest = JSON.parse(event.body || "{}");

    if (!request.message) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Message is required" }),
      };
    }

    // Add timestamp
    request.timestamp = new Date().toISOString();

    // Classify the request
    const classification = classifyRequest(request.message);

    const response: BotResponse = {
      success: true,
      type: classification.type,
      message: "Request processed",
    };

    // Try to answer from knowledge base first
    if (classification.type === "question") {
      const answer = findAnswer(request.message);
      if (answer) {
        response.answer = answer;
        response.message = "Found answer in knowledge base";

        return {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(response),
        };
      }
    }

    // For unanswered questions, bugs, or features: create issue and email
    if (
      classification.type === "question" ||
      classification.type === "bug" ||
      classification.type === "feature"
    ) {
      const issueResult = await createGitHubIssue(classification, request.email);
      if (issueResult.success) {
        response.issueCreated = true;
        response.issueUrl = issueResult.url;
      }

      const emailSent = await sendEmailNotification(
        request,
        classification,
        issueResult.url
      );
      response.emailSent = emailSent;

      if (issueResult.success) {
        response.message = `Your ${classification.type} has been recorded. [Track it here](${issueResult.url})`;
      } else {
        response.message = `Your ${classification.type} has been received and forwarded to the team.`;
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Support bot error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: "The support bot encountered an error. Please try again or contact support directly.",
      }),
    };
  }
};

export { handler };
