// Keep E2E tests deterministic and environment-safe by default.
// Individual tests can opt-in to real RPC/network calls via env flags.

process.env.NODE_ENV ??= 'test';
process.env.XCM_TEST_MODE ??= 'true';
