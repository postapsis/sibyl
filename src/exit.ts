/*
 * Author: Jamius Siam
 * Since: 11/06/2026
 */

// Thin wrapper around `process.exit`. Lives in its own module so it can be
// mocked in tests and excluded from coverage (calling the real one would not
// be useful as it's not possible to mock `process.exit` on vitest).
export const exit: (code?: number) => never = (code) => process.exit(code);
