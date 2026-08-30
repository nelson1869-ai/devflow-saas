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
    <main className="mx-auto max-w-7xl px-4 py-8 text-slate-100 sm:px-8 sm:py-10">
      <SearchClient
        initialQuery={q || ""}
        results={results}
        currentOrgName={currentOrg.name}
      />
    </main>
  );
}
