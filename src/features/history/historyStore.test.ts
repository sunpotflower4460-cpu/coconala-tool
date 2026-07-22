import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useHistoryStore, wasSessionPersisted, HISTORY_STORAGE_KEY, MAX_SESSIONS } from './historyStore';
import type { ProfitSettings } from '../../types/market';

const profitSettings: ProfitSettings = {
  buyPrice: 0,
  sellPrice: 0,
  shippingCost: 0,
  feeRate: 10,
  exchangeRate: 155,
};

type SessionSnapshot = Parameters<ReturnType<typeof useHistoryStore.getState>['saveSession']>[0];

function baseSnapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    name: 'test session',
    query: 'PS5',
    resultCards: [],
    comparedCards: [],
    profitSettings,
    dataSourceMode: 'sample' as const,
    searchStatus: null,
    searchWarnings: [],
    lastSearchedAt: null,
    ...overrides,
  };
}

describe('historyStore', () => {
  beforeEach(() => {
    useHistoryStore.getState().clearAllSessions();
  });

  it('stores dataSourceMode/searchStatus/searchWarnings/lastSearchedAt on the saved session', () => {
    const saved = useHistoryStore.getState().saveSession(
      baseSnapshot({
        dataSourceMode: 'rakuten_mock',
        searchStatus: 'mock_no_key',
        searchWarnings: ['楽天APIキーが未設定です'],
        lastSearchedAt: '2026-07-22T00:00:00.000Z',
      }),
    );
    expect(saved.dataSourceMode).toBe('rakuten_mock');
    expect(saved.searchStatus).toBe('mock_no_key');
    expect(saved.searchWarnings).toEqual(['楽天APIキーが未設定です']);
    expect(saved.lastSearchedAt).toBe('2026-07-22T00:00:00.000Z');
  });

  it('caps stored sessions at MAX_SESSIONS, dropping the oldest', () => {
    for (let i = 0; i < MAX_SESSIONS + 5; i++) {
      useHistoryStore.getState().saveSession(baseSnapshot({ name: `session-${i}` }));
    }
    expect(useHistoryStore.getState().sessions).toHaveLength(MAX_SESSIONS);
  });

  it('deleteSession removes only the targeted session', () => {
    const a = useHistoryStore.getState().saveSession(baseSnapshot({ name: 'a' }));
    useHistoryStore.getState().saveSession(baseSnapshot({ name: 'b' }));
    useHistoryStore.getState().deleteSession(a.id);
    expect(useHistoryStore.getState().sessions.map((s) => s.name)).toEqual(['b']);
  });
});

describe('wasSessionPersisted', () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalWindow = (globalThis as { window?: unknown }).window;

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: originalLocalStorage, configurable: true });
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
  });

  it('returns true when the session id round-trips through localStorage', async () => {
    // zustand's persist middleware resolves `window.localStorage` once, at
    // store-creation time, and permanently disables persistence if that throws.
    // A working `window.localStorage` must exist *before* the module is first
    // evaluated, so install it and re-import the module fresh.
    const store = new Map<string, string>();
    const mockLocalStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: mockLocalStorage });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: mockLocalStorage },
    });
    vi.resetModules();
    const fresh = await import('./historyStore');
    const saved = fresh.useHistoryStore.getState().saveSession(baseSnapshot());
    expect(fresh.wasSessionPersisted(saved.id)).toBe(true);
  });

  it('returns false when localStorage.setItem throws (quota exceeded)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        },
        removeItem: () => {},
      },
    });
    const saved = useHistoryStore.getState().saveSession(baseSnapshot());
    expect(wasSessionPersisted(saved.id)).toBe(false);
  });

  it('returns false when localStorage access itself throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: storage disabled');
      },
    });
    expect(() => wasSessionPersisted(HISTORY_STORAGE_KEY)).not.toThrow();
    expect(wasSessionPersisted(HISTORY_STORAGE_KEY)).toBe(false);
  });
});
