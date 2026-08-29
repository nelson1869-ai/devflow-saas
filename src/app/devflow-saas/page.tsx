type CapabilityItemProps = Readonly<{
  label: string;
}>;

type Capability = Readonly<{
  id: string;
  label: string;
}>;

const capabilities: readonly Capability[] = [
  { id: "projects", label: "Organize projects" },
  { id: "tasks", label: "Track tasks" },
  { id: "collaboration", label: "Collaborate with your team" },
];

function CapabilityItem({ label }: CapabilityItemProps) {
  return <li>{label}</li>;
}

function WorkflowCapabilities() {
  return (
    <section aria-labelledby="capabilities-heading">
      <h2 id="capabilities-heading">Start with the workflow essentials</h2>

      <ul>
        {capabilities.map((capability) => (
          <CapabilityItem key={capability.id} label={capability.label} />
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
