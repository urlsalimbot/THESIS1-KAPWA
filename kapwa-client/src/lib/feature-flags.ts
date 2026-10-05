// KAPWA UI feature toggles.
//
// Analytics is NOT a ready feature — it stays hidden everywhere by default.
// Opt in only for a deliberate preview build with `VITE_ENABLE_ANALYTICS=true`;
// production builds leave it off.
export const FEATURE_ANALYTICS_ENABLED =
  import.meta.env.VITE_ENABLE_ANALYTICS === 'true';
