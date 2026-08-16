// vitest shim for the "server-only" package — tests run in node, where
// the real package throws on import. Importing a server-only module in
// a test is intentional; the shim makes the import a no-op.
export {};
