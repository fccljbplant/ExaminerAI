# Testing

## Current state

- **7 test files** in `src/lib/__tests__/`
- **134 tests** — all passing
- **Framework**: Vitest
- **Coverage**: Library functions only (no API route tests yet)

## Test files

| File | Tests | What it covers |
|------|-------|----------------|
| `ai-provider.test.ts` | 15 | Token budgets, AI client config |
| `auth.test.ts` | 8 | Password hashing, JWT signing/verification |
| `behavioral-signals.test.ts` | 15 | Behavioral pattern detection |
| `course-normalization.test.ts` | 20 | Course data normalization |
| `course-validation.test.ts` | 26 | Course config validation |
| `grading-and-topics.test.ts` | 41 | Grade conversion, topic mapping |
| `logger.test.ts` | 9 | Structured logging |

## Running tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## What's NOT tested ( gaps)

- **API routes** — 90 routes, 0 integration tests
- **IDOR protection** — `assertCanAccessStudent` has no tests
- **Rate limiter** — `checkRateLimit` has no tests
- **Auth cache** — `getAuthUser` DB re-check has no tests
- **Components** — no React component tests

## How to add tests

### Unit test (library function)

```typescript
// src/lib/__tests__/my-function.test.ts
import { describe, it, expect } from "vitest";
import { myFunction } from "../my-function";

describe("myFunction", () => {
  it("does the right thing", () => {
    expect(myFunction("input")).toBe("output");
  });
});
```

### API route integration test (future)

```typescript
// src/app/api/__tests__/weekly-test.test.ts
import { describe, it, expect } from "vitest";
// Would need a test DB + mocked auth
// TODO: set up integration test infrastructure
```

## Test coverage goals

- **Short term**: Add tests for `assertCanAccessStudent`, `checkRateLimit`,
  `getAuthUser` (the new security functions)
- **Medium term**: Add API route integration tests with a test DB
- **Long term**: Component tests with React Testing Library
