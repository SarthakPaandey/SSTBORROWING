# Testing Guide

This directory contains tests for the SST Booking System.

## Running Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

## Test Structure

- `setup.ts` - Test environment configuration
- `lib/` - Unit tests for library functions
- `api/` - API route tests (to be expanded)
- `integration/` - Integration tests (to be added)
- `e2e/` - End-to-end tests (to be added)

## Writing Tests

### Example Test

```typescript
import { describe, it, expect } from 'vitest';
import { someFunction } from '@/lib/someModule';

describe('someFunction', () => {
  it('should do something', () => {
    const result = someFunction('input');
    expect(result).toBe('expected');
  });
});
```

## Test Coverage Goals

- [x] Core library functions (policies, QR, errors, validations)
- [ ] API route handlers
- [ ] Database operations
- [ ] Authentication flows
- [ ] Booking workflows
- [ ] Group booking flows
- [ ] Penalty system
- [ ] E2E user flows

## Known Issues Being Tested

1. Approval token action mismatch vulnerability
2. Middleware over-protection of public routes
3. Cron error handling

See `TEST_REPORT.md` for detailed findings.

