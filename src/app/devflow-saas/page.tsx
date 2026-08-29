type CapabilityItemProps = Readonly<{
  label: string;
}>;

function CapabilityItem({ label }: CapabilityItemProps) {
  return <li>{label}</li>;
}

function WorkflowCapabilities() {
  return (
    <section aria-labelledby="capabilities-heading">
      <h2 id="capabilities-heading">Start with the workflow essentials</h2>

      <ul>
        <CapabilityItem label="Organize projects" />
        <CapabilityItem label="Track tasks" />
        <CapabilityItem label="Collaborate with your team" />
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
