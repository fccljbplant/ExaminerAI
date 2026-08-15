/**
 * Shell Module — Public API (REDESIGN-P2 §5)
 *
 * Import from here:
 *   import { AppShellV2, ModeToggle, ActionBar } from "@/modules/shell";
 */

export { AppShellV2 } from "./app-shell-v2";
export type { AppShellV2Props } from "./app-shell-v2";
export { TopNav } from "./top-nav";
export { ClassicSidebar } from "./classic-sidebar";
export type { TopNavProps } from "./top-nav";
export { TabRow } from "./tab-row";
export { BottomNav } from "./bottom-nav";
export { AppFooter } from "./app-footer";
export { ActionBar } from "./action-bar";
export { ModeToggle } from "./mode-toggle";
export { UserMenu, initialsOf, roleLabel } from "./user-menu";
export { RoleSettings } from "./role-settings";
export { RoleHelp, type HelpTopic } from "./role-help";
export type { MeUser } from "./user-menu";
export { useBreakpoint } from "./use-breakpoint";
export type { BreakpointClass, NavItem, ShellBrand } from "./types";
