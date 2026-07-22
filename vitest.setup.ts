import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// This project imports `describe/it/expect` explicitly rather than using vitest's
// `globals: true` mode, so @testing-library/react's automatic afterEach-based
// cleanup isn't registered implicitly. Wire it up explicitly instead.
afterEach(() => {
  cleanup();
});
