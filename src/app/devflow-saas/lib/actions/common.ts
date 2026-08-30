export type ActionResponse = Readonly<{
  success: boolean;
  error?: string;
  data?: unknown;
}>;

export const USER_SESSION_COOKIE_NAME = "devflow_session_user_id";
export const ORG_SESSION_COOKIE_NAME = "devflow_session_org_id";
export const THEME_ACCENT_COOKIE_NAME = "devflow_theme_accent";
