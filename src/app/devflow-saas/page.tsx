type CapabilityItemProps = Readonly<{
  title: string;
  description: string;
}>;

type Capability = Readonly<{
  id: string;
  title: string;
  description: string;
}>;

const capabilities: readonly Capability[] = [
  {
    id: "projects",
    title: "Organize projects",
    description: "Group related work and keep delivery goals visible.",
  },
  {
    id: "tasks",
    title: "Track tasks",
    description: "Turn project goals into clear, trackable units of work.",
  },
  {
    id: "collaboration",
    title: "Collaborate with your team",
    description: "Give teammates shared context on progress and ownership.",
  },
];

function CapabilityItem({ title, description }: CapabilityItemProps) {
  return (
    <li>
      <h3>{title}</h3>
      <p>{description}</p>
    </li>
  );
}

function WorkflowCapabilities() {
  return (
    <section aria-labelledby="capabilities-heading">
      <h2 id="capabilities-heading">Start with the workflow essentials</h2>

      <ul>
        {capabilities.map((capability) => (
          <CapabilityItem
            key={capability.id}
            title={capability.title}
            description={capability.description}
          />
        ))}
      </ul>
    </section>
  );
}

export default function DevFlowPage() {
  return (
    <main>
      <header>
        <p>Developer workflow platform</p>
        <h1>DevFlow</h1>
        <p>Plan projects, organize tasks, and keep your team moving.</p>
      </header>

      <WorkflowCapabilities />
    </main>
  );
}
