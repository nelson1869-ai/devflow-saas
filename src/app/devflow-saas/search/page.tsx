import { getCurrentOrg } from "../lib/auth";
import { searchWorkspace } from "../lib/search";
import { SearchClient } from "./SearchClient";

type SearchPageProps = Readonly<{
  searchParams: Promise<{ q?: string }>;
}>;

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const currentOrg = await getCurrentOrg();
  const results = searchWorkspace(currentOrg.id, q || "");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 text-slate-100 sm:px-8">
      <SearchClient
        initialQuery={q || ""}
        results={results}
        currentOrgName={currentOrg.name}
      />
    </main>
  );
}
