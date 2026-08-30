import "server-only";

export type AiTaskEnhancement = Readonly<{
  enhancedDescription: string;
  suggestedSubtasks: readonly string[];
  suggestedEstimatedHours: number;
  suggestedPriority: "Low" | "Medium" | "High" | "Urgent";
  suggestedTag: string;
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
5. "suggestedTag": One best lowercase tag: "backend", "frontend", "ui", "feature", "security", "infra", "performance", or "bug".
6. "securityConsiderations": 1-2 sentences on security, validation, or error handling.

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
            suggestedTag: (parsed.suggestedTag || tag || "feature")
              .toLowerCase()
              .trim(),
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
  rawTag: string,
): AiTaskEnhancement {
  const lower = `${title} ${currentDescription}`.toLowerCase();

  let autoTag = rawTag || "feature";
  if (
    lower.includes("db") ||
    lower.includes("database") ||
    lower.includes("schema") ||
    lower.includes("sql") ||
    lower.includes("api") ||
    lower.includes("architecture")
  ) {
    autoTag = "backend";
  } else if (
    lower.includes("tailwind") ||
    lower.includes("style") ||
    lower.includes("css") ||
    lower.includes("theme") ||
    lower.includes("color") ||
    lower.includes("icon")
  ) {
    autoTag = "ui";
  } else if (
    lower.includes("component") ||
    lower.includes("react") ||
    lower.includes("page") ||
    lower.includes("modal") ||
    lower.includes("drawer") ||
    lower.includes("view")
  ) {
    autoTag = "frontend";
  } else if (
    lower.includes("auth") ||
    lower.includes("login") ||
    lower.includes("security") ||
    lower.includes("token") ||
    lower.includes("permission")
  ) {
    autoTag = "security";
  } else if (
    lower.includes("docker") ||
    lower.includes("ci") ||
    lower.includes("deploy") ||
    lower.includes("webhook") ||
    lower.includes("pipeline")
  ) {
    autoTag = "infra";
  } else if (
    lower.includes("speed") ||
    lower.includes("performance") ||
    lower.includes("cache") ||
    lower.includes("lighthouse") ||
    lower.includes("optimize")
  ) {
    autoTag = "performance";
  } else if (
    lower.includes("fix") ||
    lower.includes("bug") ||
    lower.includes("error") ||
    lower.includes("crash")
  ) {
    autoTag = "bug";
  }

  const enhancedDescription = `### 🎯 Overview
${currentDescription || `Implement technical deliverables for "${title}".`}

### 📋 Technical Objectives & Acceptance Criteria
- [ ] Requirements satisfy functional specifications with zero regressions.
- [ ] Comprehensive unit & integration tests pass with high branch coverage.
- [ ] Edge cases (empty states, network latency, validation errors) handled gracefully.
- [ ] Real-time audit logs and telemetry recorded for full observability.

### 🛡️ Security & Reliability Considerations
- Enforce strict input sanitation and parameterized query boundaries.
- Verify role-based authorization matrix before state mutations.`;

  return {
    enhancedDescription,
    suggestedSubtasks: [
      `Draft architecture & technical specification for ${title}`,
      `Implement core ${autoTag} business logic & validation handling`,
      "Write automated integration tests & verify boundary edge cases",
      "Perform peer code review & update team documentation",
    ],
    suggestedEstimatedHours: 6,
    suggestedPriority: "High",
    suggestedTag: autoTag,
    securityConsiderations:
      "Enforce strict input sanitation, CSRF token validation, and parameterized query boundaries.",
    source: "smart-engine",
  };
}
