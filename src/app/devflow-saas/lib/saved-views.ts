import "server-only";
import { db } from "./db";

export type SavedViewFilterCriteria = Readonly<{
  query?: string;
  assignee?: string;
  tag?: string;
  priority?: string;
  status?: string;
}>;

export type SavedView = Readonly<{
  id: string;
  orgId: string;
  userId: string;
  projectId?: string;
  name: string;
  icon: string;
  filters: SavedViewFilterCriteria;
  createdAt: string;
}>;

type SavedViewRow = {
  id: string;
  org_id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  icon: string;
  filters_json: string;
  created_at: string;
};

export function getSavedViewsByOrgAndProject(
  orgId: string,
  projectId?: string,
): readonly SavedView[] {
  try {
    let stmt;
    let rows: SavedViewRow[];

    if (projectId) {
      stmt = db.prepare(`
        SELECT id, org_id, user_id, project_id, name, icon, filters_json, created_at
        FROM devflow_saved_views
        WHERE org_id = ? AND (project_id = ? OR project_id IS NULL)
        ORDER BY created_at ASC
      `);
      rows = stmt.all(orgId, projectId) as SavedViewRow[];
    } else {
      stmt = db.prepare(`
        SELECT id, org_id, user_id, project_id, name, icon, filters_json, created_at
        FROM devflow_saved_views
        WHERE org_id = ?
        ORDER BY created_at ASC
      `);
      rows = stmt.all(orgId) as SavedViewRow[];
    }

    return rows.map((r) => {
      let parsedFilters: SavedViewFilterCriteria = {};
      try {
        parsedFilters = JSON.parse(r.filters_json);
      } catch {}

      return {
        id: r.id,
        orgId: r.org_id,
        userId: r.user_id,
        projectId: r.project_id || undefined,
        name: r.name,
        icon: r.icon,
        filters: parsedFilters,
        createdAt: r.created_at,
      };
    });
  } catch {
    return [];
  }
}
