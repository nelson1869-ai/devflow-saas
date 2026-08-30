import type { TaskPriority, TaskStatus } from "../tasks/types";

export type TemplateTaskSeed = Readonly<{
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  tag: string;
  dueDaysOffset?: number;
}>;

export type ProjectTemplate = Readonly<{
  id: string;
  name: string;
  defaultKey: string;
  description: string;
  icon: string;
  badgeColor: string;
  starterTasks: readonly TemplateTaskSeed[];
}>;

export const projectTemplates: readonly ProjectTemplate[] = [
  {
    id: "scrum-sprint",
    name: "Scrum Sprint Delivery",
    defaultKey: "SPRN",
    description:
      "2-week agile sprint cycle with backlog refinement, implementation, and QA verification.",
    icon: "🚀",
    badgeColor: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    starterTasks: [
      {
        title: "Sprint Backlog Refinement & Story Pointing",
        description:
          "Review acceptance criteria with engineering team:\n- [ ] Estimate story points\n- [ ] Assign deliverables to engineers\n- [ ] Clarify edge cases and API contracts",
        status: "In Progress",
        priority: "High",
        tag: "feature",
        dueDaysOffset: 2,
      },
      {
        title: "Technical Architecture RFC & Review",
        description:
          "Draft system design document for core milestone deliverables.\n- [ ] Database schema changes\n- [ ] Rate limiting boundaries",
        status: "Todo",
        priority: "Medium",
        tag: "backend",
        dueDaysOffset: 4,
      },
      {
        title: "Core Feature Implementation & Unit Tests",
        description:
          "Implement API routes, client UI components, and automated test coverage.",
        status: "Todo",
        priority: "High",
        tag: "frontend",
        dueDaysOffset: 8,
      },
      {
        title: "QA End-to-End Regression & Load Benchmarking",
        description:
          "Validate performance under 10k req/min traffic simulator and sign off for release.",
        status: "Todo",
        priority: "Urgent",
        tag: "infra",
        dueDaysOffset: 12,
      },
    ],
  },
  {
    id: "bug-tracker",
    name: "Bug Tracker & Incident Response",
    defaultKey: "BUG",
    description:
      "Triage defects, investigate production errors, issue hotfixes, and document post-mortems.",
    icon: "🐛",
    badgeColor: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    starterTasks: [
      {
        title: "Triage Production Sentry Exception Alerts",
        description:
          "Investigate unhandled promise rejections in authentication middleware:\n- [ ] Inspect stack traces\n- [ ] Check affected user impact count",
        status: "Todo",
        priority: "Urgent",
        tag: "bug",
        dueDaysOffset: 1,
      },
      {
        title: "Reproduction Script & Failing Test Suite",
        description:
          "Construct minimal reproducible test case replicating the edge-case race condition.",
        status: "Todo",
        priority: "High",
        tag: "security",
        dueDaysOffset: 2,
      },
      {
        title: "Hotfix Patch & Database Data Repair",
        description:
          "Deploy urgent hotfix patch and run data reconciliation migration.",
        status: "Todo",
        priority: "Urgent",
        tag: "backend",
        dueDaysOffset: 3,
      },
      {
        title: "Post-Mortem & Preventative Safeguards",
        description:
          "Document incident timeline, root cause, and establish preventive lint rules.",
        status: "Todo",
        priority: "Medium",
        tag: "infra",
        dueDaysOffset: 5,
      },
    ],
  },
  {
    id: "architecture-rfc",
    name: "Architecture RFC & Tech Debt",
    defaultKey: "RFC",
    description:
      "System redesigns, API versioning upgrades, security hardening, and database refactors.",
    icon: "🏛️",
    badgeColor: "border-purple-500/30 bg-purple-500/10 text-purple-400",
    starterTasks: [
      {
        title: "Draft Architecture RFC Document",
        description:
          "Detail trade-offs between Redis distributed locks vs PostgreSQL advisory locks.",
        status: "In Progress",
        priority: "High",
        tag: "backend",
        dueDaysOffset: 5,
      },
      {
        title: "Security Hardening & RBAC Compliance Review",
        description:
          "Audit role permissions matrix across multi-tenant boundaries.",
        status: "Todo",
        priority: "Medium",
        tag: "security",
        dueDaysOffset: 7,
      },
      {
        title: "Zero-Downtime Database Migration Pipeline",
        description:
          "Establish blue/green shadow column migration strategy without locking reads.",
        status: "Todo",
        priority: "High",
        tag: "infra",
        dueDaysOffset: 10,
      },
    ],
  },
  {
    id: "custom-blank",
    name: "Blank Canvas",
    defaultKey: "PROJ",
    description:
      "Start from scratch with an empty Kanban board for custom project workflows.",
    icon: "📄",
    badgeColor: "border-slate-500/30 bg-slate-500/10 text-slate-400",
    starterTasks: [],
  },
];
