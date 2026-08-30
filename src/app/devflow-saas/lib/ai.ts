import "server-only";

export type AiTaskEnhancement = Readonly<{
  enhancedDescription: string;
  suggestedSubtasks: readonly string[];
  suggestedEstimatedHours: number;
  suggestedPriority: "Low" | "Medium" | "High" | "Urgent";
  securityConsiderations: string;
  source: "gemini-api" | "smart-engine";
}>;

export async function generateAiTaskBreakdown(
  title: string,
  currentDescription: string,
  tag: string,
): Promise<AiTaskEnhancement> {
  const geminiApiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;

  if (geminiApiKey) {
    try {
      const prompt = `
You are an expert Principal Software Engineer and Technical Product Manager.
Analyze this software task:
- Title: "${title}"
- Domain Tag: "${tag}"
- Current Draft Description: "${currentDescription}"
- Seed: "${Date.now()}-${Math.random()}"

Provide a structured JSON output with the following exact keys:
1. "enhancedDescription": High-quality markdown description with Background, Objectives, and Acceptance Criteria (in bullet or checklist format).
2. "suggestedSubtasks": Array of 3 to 5 clear, actionable subtask titles.
3. "suggestedEstimatedHours": Realistic numeric engineering effort in hours (e.g. 4, 6, 8).
4. "suggestedPriority": One of "Low", "Medium", "High", "Urgent".
5. "securityConsiderations": 1-2 sentences on security, validation, or error handling.

Return ONLY raw JSON, with no markdown code blocks.
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.85,
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
        "Collect client crash stack traces & telemetry logs",
        "Fix boundary edge-case handling & null checks",
        "Add automated end-to-end regression test suite",
        "Verify fix across desktop and mobile devices",
      ],
      [
        "Trace asynchronous state race condition",
        "Refactor component cleanup & teardown listeners",
        "Run memory leak & performance profiling check",
        "Release hotfix & update issue tracker",
      ],
    ],
    infra: [
      [
        "Configure infrastructure as code / script parameters",
        "Implement automated retry mechanism with backoff",
        "Test end-to-end failover and backup restoration",
        "Configure alerting alerts for pipeline failures",
      ],
      [
        "Audit cloud resource permissions & IAM roles",
        "Implement scheduled health checks & uptime monitors",
        "Optimize build caching & docker container layer size",
        "Document disaster recovery runbook",
      ],
      [
        "Set up encrypted storage buckets & retention policies",
        "Configure zero-downtime rolling deployment stages",
        "Verify network latency & TLS certificate renewal",
        "Stress test throughput under peak load",
      ],
    ],
    general: [
      [
        `Draft architecture & technical specification for ${title}`,
        "Implement core logic & error boundary handling",
        "Write automated integration tests & verify edge cases",
        "Perform code review & update team documentation",
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

  const enhancedDescription = `### 🎯 Overview
${currentDescription || `Deliver robust implementation for **${title}**.`}

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
    source: "smart-engine",
  };
}
