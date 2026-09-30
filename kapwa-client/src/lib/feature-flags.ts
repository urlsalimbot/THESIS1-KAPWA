// KAPWA UI feature toggles.
//
// Analytics is a shipped staff feature (admin + social worker — the API's
// @Roles gates match the client route/nav). It is on by default; build with
// `VITE_ENABLE_ANALYTICS=false` to hide it.
export const FEATURE_ANALYTICS_ENABLED =
  import.meta.env.VITE_ENABLE_ANALYTICS !== 'false';
