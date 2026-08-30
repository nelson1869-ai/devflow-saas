import type { TaskPriority, TaskStatus } from "../tasks/types";

export type AIDomain =
  | "frontend"
  | "backend"
  | "fullstack"
  | "mobile"
  | "devops"
  | "ai_ml"
  | "security"
  | "ecommerce"
  | "general";

export type AIGeneratedTask = Readonly<{
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  tag: string;
  estimatedHours: number;
  subtasks: readonly string[];
  dueDaysOffset: number;
}>;

export type AIProjectPlan = Readonly<{
  suggestedKey: string;
  detectedDomain: AIDomain;
  domainLabel: string;
  domainIcon: string;
  summaryAnalysis: string;
  tasks: readonly AIGeneratedTask[];
}>;

/**
 * Domain-Oriented AI Planner
 * Analyzes raw project title and description to intelligently synthesize
 * architecture, domain tags, key, priorities, and actionable sprint tasks.
 */
export function analyzeAndGenerateProjectPlan(
  projectName: string,
  rawDescription?: string,
): AIProjectPlan {
  const text = `${projectName} ${rawDescription || ""}`.toLowerCase();

  // 1. Domain Detection Analysis
  let domain: AIDomain = "general";
  let domainLabel = "General Software Engineering";
  let domainIcon = "⚡";
  let keyPrefix = "PROJ";

  if (
    text.includes("front") ||
    text.includes("ui") ||
    text.includes("ux") ||
    text.includes("tailwind") ||
    text.includes("react") ||
    text.includes("landing") ||
    text.includes("storefront") ||
    text.includes("dashboard")
  ) {
    domain = "frontend";
    domainLabel = "Frontend & UI Architecture";
    domainIcon = "🎨";
    keyPrefix = "FE";
  } else if (
    text.includes("shop") ||
    text.includes("commerce") ||
    text.includes("stripe") ||
    text.includes("payment") ||
    text.includes("checkout") ||
    text.includes("cart")
  ) {
    domain = "ecommerce";
    domainLabel = "E-Commerce & Payments";
    domainIcon = "🛍️";
    keyPrefix = "SHOP";
  } else if (
    text.includes("mobile") ||
    text.includes("react native") ||
    text.includes("flutter") ||
    text.includes("ios") ||
    text.includes("android") ||
    text.includes("app")
  ) {
    domain = "mobile";
    domainLabel = "Mobile Application Development";
    domainIcon = "📱";
    keyPrefix = "MOB";
  } else if (
    text.includes("ai") ||
    text.includes("llm") ||
    text.includes("agent") ||
    text.includes("openai") ||
    text.includes("rag") ||
    text.includes("embedding") ||
    text.includes("machine learning")
  ) {
    domain = "ai_ml";
    domainLabel = "AI & Machine Learning Engine";
    domainIcon = "🧠";
    keyPrefix = "AI";
  } else if (
    text.includes("api") ||
    text.includes("backend") ||
    text.includes("database") ||
    text.includes("sql") ||
    text.includes("microservice") ||
    text.includes("server")
  ) {
    domain = "backend";
    domainLabel = "Backend Microservices & Databases";
    domainIcon = "⚙️";
    keyPrefix = "API";
  } else if (
    text.includes("docker") ||
    text.includes("kubernetes") ||
    text.includes("ci/cd") ||
    text.includes("devops") ||
    text.includes("cloud") ||
    text.includes("aws") ||
    text.includes("infra")
  ) {
    domain = "devops";
    domainLabel = "Cloud Infrastructure & DevOps";
    domainIcon = "☁️";
    keyPrefix = "OPS";
  } else if (
    text.includes("auth") ||
    text.includes("security") ||
    text.includes("oauth") ||
    text.includes("audit") ||
    text.includes("crypto") ||
    text.includes("firewall")
  ) {
    domain = "security";
    domainLabel = "Cybersecurity & Identity";
    domainIcon = "🛡️";
    keyPrefix = "SEC";
  }

  // Generate a clean 2-4 letter uppercase key based on project name if possible
  const cleanedWords = projectName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  let suggestedKey = keyPrefix;
  if (cleanedWords.length >= 2) {
    const letters = cleanedWords
      .map((w) => w[0])
      .join("")
      .slice(0, 4)
      .toUpperCase();
    if (letters.length >= 2) suggestedKey = letters;
  } else if (cleanedWords.length === 1 && cleanedWords[0].length >= 3) {
    suggestedKey = cleanedWords[0].slice(0, 4).toUpperCase();
  }

  // 2. Synthesize Domain-Oriented Tasks (All initialized to Todo)
  const tasks = generateDomainTasks(domain, projectName);

  return {
    suggestedKey,
    detectedDomain: domain,
    domainLabel,
    domainIcon,
    summaryAnalysis: `AI analyzed "${projectName}" as a ${domainLabel} initiative. Synthesized ${tasks.length} domain-tailored sprint deliverables with subtask checklists and workload estimates.`,
    tasks,
  };
}

function generateDomainTasks(
  domain: AIDomain,
  projectName: string,
): readonly AIGeneratedTask[] {
  switch (domain) {
    case "frontend":
      return [
        {
          title: `Design Tokens & Tailwind CSS Theme for ${projectName}`,
          description:
            "Configure typography scales, color palettes, dark mode utility classes, and global CSS layout variables.",
          status: "Todo",
          priority: "High",
          tag: "ui",
          estimatedHours: 4,
          subtasks: [
            "Setup CSS variables in globals.css",
            "Configure Tailwind theme accent classes",
            "Add WCAG 2.1 AA text contrast validation",
          ],
          dueDaysOffset: 1,
        },
        {
          title: "Responsive Header, Navigation Bar & Mobile Drawer",
          description:
            "Build keyboard accessible header navigation with active route highlighting and sliding mobile drawer.",
          status: "Todo",
          priority: "Urgent",
          tag: "frontend",
          estimatedHours: 6,
          subtasks: [
            "Implement desktop nav links with active pills",
            "Build full-height mobile drawer overlay",
            "Add Escape key listener and background scroll lock",
          ],
          dueDaysOffset: 3,
        },
        {
          title: "Main Interactive UI View & Dynamic Filters",
          description:
            "Construct responsive core viewport with instant client-side filtering, search queries, and empty states.",
          status: "Todo",
          priority: "High",
          tag: "frontend",
          estimatedHours: 8,
          subtasks: [
            "Build responsive 4-column card grid",
            "Add horizontal chip scroll on mobile screens",
            "Implement debounced instant search input",
          ],
          dueDaysOffset: 5,
        },
        {
          title: "State Management & Optimistic UI Transitions",
          description:
            "Connect client state using React 19 useOptimistic and useTransition for zero-latency user interactions.",
          status: "Todo",
          priority: "High",
          tag: "feature",
          estimatedHours: 8,
          subtasks: [
            "Add optimistic status updates on user actions",
            "Implement graceful rollback on network error",
            "Persist client preferences to localStorage",
          ],
          dueDaysOffset: 8,
        },
        {
          title: "Lighthouse Performance & Core Web Vitals Audit",
          description:
            "Audit performance, optimize Next.js Image components, eliminate layout shift (CLS), and reach 95+ score.",
          status: "Todo",
          priority: "Medium",
          tag: "performance",
          estimatedHours: 4,
          subtasks: [
            "Optimize bundle size and dynamic imports",
            "Ensure Largest Contentful Paint (LCP) < 1.8s",
            "Fix missing alt tags and aria labels",
          ],
          dueDaysOffset: 12,
        },
      ];

    case "ecommerce":
      return [
        {
          title: "Product Catalog Database Schema & Category Taxonomy",
          description:
            "Design normalized SQLite schema for products, variants, pricing, inventory stock, and media assets.",
          status: "Todo",
          priority: "High",
          tag: "backend",
          estimatedHours: 6,
          subtasks: [
            "Define products, variants, and categories tables",
            "Add compound indices for fast price & tag lookups",
            "Seed starter product catalog data",
          ],
          dueDaysOffset: 2,
        },
        {
          title: "Shopping Cart State & Persistent Checkout Context",
          description:
            "Build client-side cart drawer with quantity increments, discount code validation, and cookie persistence.",
          status: "Todo",
          priority: "Urgent",
          tag: "feature",
          estimatedHours: 8,
          subtasks: [
            "Create Cart Slide-over Panel",
            "Implement useOptimistic cart count badge",
            "Sync cart payload across browser tabs",
          ],
          dueDaysOffset: 4,
        },
        {
          title: "Stripe Checkout Session & Secure Webhook Listener",
          description:
            "Integrate Stripe Payment Sheet, customer billing addresses, and idempotent webhook fulfillment.",
          status: "Todo",
          priority: "Urgent",
          tag: "security",
          estimatedHours: 10,
          subtasks: [
            "Create Server Action for Stripe Checkout session",
            "Implement POST /api/webhooks/stripe handler",
            "Validate Stripe signature with endpoint secret",
            "Update order status to 'Paid' upon checkout.session.completed",
          ],
          dueDaysOffset: 7,
        },
        {
          title: "Automated Customer Email Receipts via Resend API",
          description:
            "Trigger responsive HTML receipt emails with line-item breakdown and tracking link upon order completion.",
          status: "Todo",
          priority: "Medium",
          tag: "infra",
          estimatedHours: 4,
          subtasks: [
            "Design transactional email template",
            "Connect Resend API webhook dispatcher",
            "Add automated retry for transient network errors",
          ],
          dueDaysOffset: 10,
        },
      ];

    case "ai_ml":
      return [
        {
          title: "Vector Database Setup & Document Chunking Pipeline",
          description:
            "Configure embedding model ingestion pipeline with hierarchical chunking and metadata filtering.",
          status: "Todo",
          priority: "High",
          tag: "ai",
          estimatedHours: 8,
          subtasks: [
            "Setup cosine similarity search index",
            "Implement recursive text chunker (500 token window)",
            "Store embeddings with tenant-isolated metadata",
          ],
          dueDaysOffset: 2,
        },
        {
          title: "RAG Retrieval & Prompt Engineering Orchestrator",
          description:
            "Build context-augmented prompt assembler with system guardrails and multi-query expansion.",
          status: "Todo",
          priority: "Urgent",
          tag: "ai",
          estimatedHours: 10,
          subtasks: [
            "Implement top-k vector similarity retrieval",
            "Add citation source tracking in output stream",
            "Apply safety filters and prompt injection shields",
          ],
          dueDaysOffset: 5,
        },
        {
          title: "Real-time Token Streaming UI with Markdown Parser",
          description:
            "Create low-latency streaming chat interface with syntax-highlighted code blocks and copy buttons.",
          status: "Todo",
          priority: "High",
          tag: "frontend",
          estimatedHours: 6,
          subtasks: [
            "Connect ReadableStream with React 19 UI",
            "Render live KaTeX math and code fences",
            "Add auto-scroll pinning to bottom on new tokens",
          ],
          dueDaysOffset: 8,
        },
        {
          title: "Token Usage Quota Tracking & Rate Limiting",
          description:
            "Track per-organization token consumption and enforce monthly tier limits with Redis sliding window.",
          status: "Todo",
          priority: "Medium",
          tag: "backend",
          estimatedHours: 4,
          subtasks: [
            "Log prompt and completion token counts per request",
            "Enforce tenant quota limits",
            "Show remaining token budget progress bar in UI",
          ],
          dueDaysOffset: 12,
        },
      ];

    case "mobile":
      return [
        {
          title: "Navigation Shell & Gesture Handling System",
          description:
            "Setup bottom tab bar navigation with native stack screens, transitions, and safe area insets.",
          status: "Todo",
          priority: "High",
          tag: "mobile",
          estimatedHours: 6,
          subtasks: [
            "Configure bottom tabs and stack routing",
            "Implement swipe-to-dismiss gesture listeners",
            "Handle iOS dynamic island & Android status bar safe areas",
          ],
          dueDaysOffset: 2,
        },
        {
          title: "Offline SQLite Cache & Sync Engine",
          description:
            "Implement local SQLite database caching with conflict-resolution and background delta sync.",
          status: "Todo",
          priority: "Urgent",
          tag: "mobile",
          estimatedHours: 10,
          subtasks: [
            "Create local offline database tables",
            "Queue mutations when network is offline",
            "Replay queue automatically on connection restore",
          ],
          dueDaysOffset: 5,
        },
        {
          title: "Push Notifications & Deep Linking Handlers",
          description:
            "Configure APNs / FCM push notification channels with universal deep link routing.",
          status: "Todo",
          priority: "High",
          tag: "feature",
          estimatedHours: 6,
          subtasks: [
            "Register device push token in database",
            "Handle foreground and background notification taps",
            "Route users directly to specific task/project deep links",
          ],
          dueDaysOffset: 8,
        },
      ];

    default:
      return [
        {
          title: `Project Architecture RFC & Design for ${projectName}`,
          description:
            "Draft system design specifications, data models, and API interfaces for sprint deliverables.",
          status: "Todo",
          priority: "High",
          tag: "feature",
          estimatedHours: 6,
          subtasks: [
            "Define system boundaries and technical constraints",
            "Document API schemas and contract interfaces",
            "Identify security and performance requirements",
          ],
          dueDaysOffset: 2,
        },
        {
          title: "Core Feature Implementation & Business Logic",
          description:
            "Implement primary domain services, validation logic, and automated unit test suite.",
          status: "Todo",
          priority: "Urgent",
          tag: "backend",
          estimatedHours: 10,
          subtasks: [
            "Implement core application logic",
            "Write comprehensive automated unit test suite",
            "Add integration tests with database fixtures",
          ],
          dueDaysOffset: 5,
        },
        {
          title: "Interactive User Interface & Component Assembly",
          description:
            "Build accessible, responsive UI views with modern design tokens and error handling.",
          status: "Todo",
          priority: "High",
          tag: "frontend",
          estimatedHours: 8,
          subtasks: [
            "Build interactive client UI components",
            "Implement responsive mobile/desktop layouts",
            "Add accessible ARIA attributes and keyboard shortcuts",
          ],
          dueDaysOffset: 8,
        },
        {
          title: "Security Hardening, Linting & Production QA",
          description:
            "Execute end-to-end regression tests, verify role permissions, and prepare deployment pipeline.",
          status: "Todo",
          priority: "Medium",
          tag: "security",
          estimatedHours: 4,
          subtasks: [
            "Run static code analysis and lint verification",
            "Audit role-based authorization guards",
            "Benchmark response latency under load",
          ],
          dueDaysOffset: 12,
        },
      ];
  }
}
