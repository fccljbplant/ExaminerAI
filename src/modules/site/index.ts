/**
 * modules/site — shared public storefront chrome (2026-08-15)
 *
 * One header + one footer for every public page, replacing the
 * per-page hand-rolled banners (and the pages that had no chrome at
 * all). Token-only styling; server data (auth state, category counts)
 * is passed in as props by the (public) layout.
 */

export { SiteHeader, type SiteCategory } from "./site-header";
export { SiteFooter } from "./site-footer";
