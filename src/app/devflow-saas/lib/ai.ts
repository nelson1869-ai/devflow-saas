import type { TaskPriority } from "../tasks/types";

export type AiTaskEnhancement = {
  enhancedDescription: string;
  suggestedSubtasks: readonly string[];
  suggestedEstimatedHours: number;
  suggestedPriority: TaskPriority;
  securityConsiderations?: string;
  source: "gemini-api" | "heuristic";
};

/**
 * Generate structured task enhancement using Google Gemini 1.5 Flash API or Smart Fallback Engine.
 */
export async function generateAiTaskBreakdown(
  title: string,
  currentDescription: string,
  tag: string,
): Promise<AiTaskEnhancement> {
  const geminiApiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY;

  if (geminiApiKey) {
    try {
      const prompt = `You are an expert SaaS software architect. Analyze this engineering task and generate a structured JSON breakdown.
Task Title: "${title}"
Domain Tag: "${tag}"
Current Notes: "${currentDescription}"

Respond ONLY with valid JSON in this exact schema (no code fences, no extra text):
{
  "enhancedDescription": "Comprehensive markdown description including 🎯 Overview, 📋 Acceptance Criteria checklist, and 🛡️ Security considerations",
  "suggestedSubtasks": ["Concrete implementation step 1", "Step 2", "Step 3", "Step 4"],
  "suggestedEstimatedHours": 6,
  "suggestedPriority": "High",
  "securityConsiderations": "Key safeguard or threat mitigation note"
}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.85,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          return {
            enhancedDescription:
              parsed.enhancedDescription || currentDescription,
            suggestedSubtasks: Array.isArray(parsed.suggestedSubtasks)
              ? parsed.suggestedSubtasks
              : [
                  "Implement core functionality",
                  "Write unit & integration tests",
                  "Document API changes",
                ],
            suggestedEstimatedHours:
              typeof parsed.suggestedEstimatedHours === "number"
                ? parsed.suggestedEstimatedHours
                : 6,
            suggestedPriority: ["Low", "Medium", "High", "Urgent"].includes(
              parsed.suggestedPriority,
            )
              ? parsed.suggestedPriority
              : "Medium",
            securityConsiderations:
              parsed.securityConsiderations ||
              "Validate all user inputs and enforce authorization checks.",
            source: "gemini-api",
          };
        }
      }
    } catch (err) {
      console.warn(
        "Gemini API call failed, falling back to smart engine:",
        err,
      );
    }
  }

  // Dynamic Smart Engine with diverse variations
  return generateDynamicHeuristicBreakdown(title, currentDescription, tag);
}

function generateDynamicHeuristicBreakdown(
  title: string,
  currentDescription: string,
  tag: string,
): AiTaskEnhancement {
  const isSecurity =
    tag === "security" || /auth|token|jwt|crypto|permission/i.test(title);
  const isBug = tag === "bug" || /fix|bug|leak|error|crash/i.test(title);
  const isInfra =
    tag === "infra" || /docker|pipeline|ci|cd|s3|db|backup/i.test(title);

  const randomVariant = Math.floor(Math.random() * 3);

  const subtaskPools: Record<string, string[][]> = {
    security: [
      [
        "Review threat model & attack surface",
        "Implement secure token validation & expiry handling",
        "Add automated penetration / fuzzing regression tests",
        "Verify audit logs for sensitive operations",
      ],
      [
        "Audit existing authentication & authorization gates",
        "Implement constant-time cryptographic hash verification",
        "Add rate limiting & brute-force mitigation headers",
        "Perform security code review & vulnerability assessment",
      ],
      [
        "Enforce strict least-privilege role validation",
        "Sanitize request parameters to prevent injection attacks",
        "Write integration tests for unauthorized 401/403 responses",
        "Document security operational guidelines",
      ],
    ],
    bug: [
      [
        "Reproduce defect with minimal failing unit test",
        "Identify root cause in state / connection lifecycle",
        "Implement fix and verify no regression across views",
        "Deploy patch to staging environment",
      ],
      [
        "Inspect error boundary telemetry and stack trace",
        "Patch edge case handling in async data flow",
        "Add regression test suite for reproducing conditions",
        "Verify resolution across client viewports",
      ],
      [
        "Profile memory heap and active listeners",
        "Eliminate memory leaks and dangling subscriptions",
        "Stress test concurrent load in local sandbox",
        "Update monitoring alert thresholds",
      ],
    ],
    infra: [
      [
        "Design infrastructure configuration & secrets management",
        "Provision pipeline execution stages & caching",
        "Implement health check telemetry & alert thresholds",
        "Conduct failover drills & rollback validation",
      ],
      [
        "Review cloud resource quotas and network VPC peering",
        "Configure automated backup snapshot lifecycle",
        "Set up encrypted storage buckets and access policies",
        "Verify automated database restore in staging",
      ],
      [
        "Audit CI/CD build runner dependencies & cache hit rate",
        "Optimize container image build layers & binary size",
        "Add automated vulnerability scanning in pipeline",
        "Publish infrastructure architecture diagram",
      ],
    ],
    general: [
      [
        "Break down technical architecture & component boundaries",
        "Implement core business logic & data persistence",
        "Write unit tests with edge-case test coverage",
        "Document API contracts & integration endpoints",
      ],
      [
        "Design modular component interfaces & data contracts",
        "Build interactive UI state transitions & loading skeletons",
        "Verify accessibility standards (WCAG keyboard & aria)",
        "Conduct peer review & QA smoke testing",
      ],
      [
        "Define schema models & server action endpoints",
        "Implement responsive layout styling across screen sizes",
        "Add telemetry tracking for user interactions",
        "Prepare release notes & demo walkthrough",
      ],
    ],
  };

  const domainKey = isSecurity
    ? "security"
    : isBug
      ? "bug"
      : isInfra
        ? "infra"
        : "general";
  const pool = subtaskPools[domainKey];
  const suggestedSubtasks = pool[randomVariant % pool.length];

  const priorities: ("Low" | "Medium" | "High" | "Urgent")[] = isSecurity
    ? ["High", "Urgent", "High"]
    : isBug
      ? ["Urgent", "High", "Urgent"]
      : ["Medium", "High", "Low"];

  const hoursOptions = isSecurity
    ? [8, 12, 6]
    : isBug
      ? [3, 4, 6]
      : isInfra
        ? [5, 8, 4]
        : [4, 6, 8];

  const securityNotes = [
    "Enforce cryptographic constant-time comparison and verify strict CSRF/CORS origin headers.",
    "Validate all user input bounds and ensure parameterized queries to prevent injection.",
    "Ensure audit activity trails are dispatched with actor attribution and timestamps.",
  ];

  // Strip previously generated markdown headers to avoid duplication on re-generation
  const cleanBaseDescription = (currentDescription || "")
    .split(
      /### 🎯 Overview|### 📋 Acceptance Criteria|### 🛡️ Security & Reliability/i,
    )[0]
    .replace(/[🎯📋🛡️]/g, "")
    .trim();

  const enhancedDescription = `### 🎯 Overview
${cleanBaseDescription || `Deliver robust implementation for **${title}**.`}

### 📋 Acceptance Criteria
- [ ] Requirements satisfy functional specifications with zero regressions.
- [ ] Comprehensive unit & integration tests pass with high branch coverage.
- [ ] Edge cases (empty states, network latency, validation errors) handled gracefully.
- [ ] Real-time audit logs and telemetry recorded for full observability.

### 🛡️ Security & Reliability
${securityNotes[randomVariant % securityNotes.length]}`;

  return {
    enhancedDescription,
    suggestedSubtasks,
    suggestedEstimatedHours: hoursOptions[randomVariant % hoursOptions.length],
    suggestedPriority: priorities[randomVariant % priorities.length],
    securityConsiderations: securityNotes[randomVariant % securityNotes.length],
    source: "heuristic",
  };
}
