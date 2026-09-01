import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useHistoryStore, wasSessionPersisted, HISTORY_STORAGE_KEY, MAX_SESSIONS } from './historyStore';
import type { ProfitSettings } from '../../types/market';
import { HISTORY_PERSIST_VERSION } from '../../lib/persistSanitize';

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

function version0Session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'legacy-ok',
    name: '旧形式の履歴',
    query: 'PS5',
    resultCards: [
      {
        id: 'c1',
        title: 'PS5 本体',
        siteName: 'sample',
        sourceType: 'manual',
        pageUrl: 'https://example.com/ps5',
        priceValue: 8000,
        confidence: 'high',
        createdAt: '2026-07-22T00:00:00.000Z',
      },
    ],
    comparedCards: [],
    profitSettings: { buyPrice: 8000, sellPrice: 12000, shippingCost: 0, feeRate: 10, exchangeRate: 155 },
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    dataSourceMode: 'rakuten_mock',
    searchStatus: 'official_api',
    searchWarnings: ['楽天市場 公式API取得。価格・在庫は変動します。'],
    lastSearchedAt: '2026-07-22T00:00:00.000Z',
    ...overrides,
  };
}

function installMemoryLocalStorage(initial?: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => void store.delete(key),
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: mockLocalStorage });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: mockLocalStorage,
      addEventListener: () => {},
    },
  });
  return { store, mockLocalStorage };
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
      value: { localStorage: mockLocalStorage, addEventListener: () => {} },
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
    expect(useHistoryStore.getState().sessions.some((session) => session.id === saved.id)).toBe(false);
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

describe('history persist version 0 → 1 migrate', () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalWindow = (globalThis as { window?: unknown }).window;

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: originalLocalStorage, configurable: true });
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
    vi.resetModules();
  });

  it('ケースA: version 0 の正常履歴を hydrate し、件数と中身を保持する', async () => {
    installMemoryLocalStorage({
      [HISTORY_STORAGE_KEY]: JSON.stringify({
        state: { sessions: [version0Session()] },
        version: 0,
      }),
    });
    vi.resetModules();
    const fresh = await import('./historyStore');
    await fresh.useHistoryStore.persist.rehydrate();

    const sessions = fresh.useHistoryStore.getState().sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].name).toBe('旧形式の履歴');
    expect(sessions[0].query).toBe('PS5');
    expect(sessions[0].resultCards[0]?.title).toBe('PS5 本体');
    expect(sessions[0].profitSettings.buyPrice).toBe(8000);
    expect(sessions[0].searchStatus).toBe('official_api');
    expect(sessions[0].lastSearchedAt).toBe('2026-07-22T00:00:00.000Z');

    const persisted = JSON.parse(globalThis.localStorage.getItem(HISTORY_STORAGE_KEY) ?? '{}') as {
      version?: number;
    };
    expect(persisted.version).toBe(HISTORY_PERSIST_VERSION);
  });

  it('ケースB: 壊れた1件だけ除外し、正常セッションは残して白画面にしない', async () => {
    installMemoryLocalStorage({
      [HISTORY_STORAGE_KEY]: JSON.stringify({
        state: {
          sessions: [version0Session({ id: 'keep-me', name: '残る履歴' }), { name: '壊れた履歴' }],
        },
        version: 0,
      }),
    });
    vi.resetModules();
    const fresh = await import('./historyStore');
    await expect(fresh.useHistoryStore.persist.rehydrate()).resolves.toBeUndefined();
    const sessions = fresh.useHistoryStore.getState().sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('keep-me');
    expect(sessions[0].name).toBe('残る履歴');
  });

  it('ケースC: 完全に壊れた persisted state は初期状態へフォールバックする', async () => {
    installMemoryLocalStorage({
      [HISTORY_STORAGE_KEY]: '{not-json',
    });
    vi.resetModules();
    const fresh = await import('./historyStore');
    await expect(fresh.useHistoryStore.persist.rehydrate()).resolves.toBeUndefined();
    expect(fresh.useHistoryStore.getState().sessions).toEqual([]);
  });
});

describe('history persist rollback', () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalWindow = (globalThis as { window?: unknown }).window;

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: originalLocalStorage, configurable: true });
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
    vi.resetModules();
  });

  it('ケースA: 既存20件に21件目を保存できたら新規が先頭で最古1件だけ落ちる', async () => {
    installMemoryLocalStorage();
    vi.resetModules();
    const fresh = await import('./historyStore');
    const ids: string[] = [];
    for (let i = 0; i < MAX_SESSIONS; i++) {
      ids.push(fresh.useHistoryStore.getState().saveSession(baseSnapshot({ name: `session-${i}` })).id);
    }
    const newest = fresh.useHistoryStore.getState().saveSession(baseSnapshot({ name: 'session-21' }));
    const sessions = fresh.useHistoryStore.getState().sessions;
    expect(sessions).toHaveLength(MAX_SESSIONS);
    expect(sessions[0].id).toBe(newest.id);
    expect(sessions.map((session) => session.id)).not.toContain(ids[0]);
    expect(sessions.map((session) => session.id)).toContain(ids[ids.length - 1]);
  });

  it('ケースB: 既存20件の21件目保存が失敗したら保存前の20件が完全に残る', async () => {
    const store = new Map<string, string>();
    let failNextSetItem = false;
    const mockLocalStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failNextSetItem) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        store.set(key, value);
      },
      removeItem: (key: string) => void store.delete(key),
    };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: mockLocalStorage });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: mockLocalStorage, addEventListener: () => {} },
    });
    vi.resetModules();
    const fresh = await import('./historyStore');

    const ids: string[] = [];
    for (let i = 0; i < MAX_SESSIONS; i++) {
      ids.push(fresh.useHistoryStore.getState().saveSession(baseSnapshot({ name: `session-${i}` })).id);
    }
    const beforeIds = fresh.useHistoryStore.getState().sessions.map((session) => session.id);
    expect(beforeIds).toHaveLength(MAX_SESSIONS);

    failNextSetItem = true;
    const newest = fresh.useHistoryStore.getState().saveSession(baseSnapshot({ name: 'session-21' }));

    const after = fresh.useHistoryStore.getState().sessions;
    expect(after).toHaveLength(MAX_SESSIONS);
    expect(after.map((session) => session.id)).toEqual(beforeIds);
    expect(after.some((session) => session.id === newest.id)).toBe(false);
    expect(after.map((session) => session.id)).toContain(ids[0]);
  });

  it('ケースC: 既存5件で保存失敗したら元の5件へ完全rollbackする', async () => {
    const store = new Map<string, string>();
    let failNextSetItem = false;
    const mockLocalStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failNextSetItem) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        store.set(key, value);
      },
      removeItem: (key: string) => void store.delete(key),
    };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: mockLocalStorage });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: mockLocalStorage, addEventListener: () => {} },
    });
    vi.resetModules();
    const fresh = await import('./historyStore');
    for (let i = 0; i < 5; i++) {
      fresh.useHistoryStore.getState().saveSession(baseSnapshot({ name: `keep-${i}` }));
    }
    const beforeIds = fresh.useHistoryStore.getState().sessions.map((session) => session.id);
    failNextSetItem = true;
    fresh.useHistoryStore.getState().saveSession(baseSnapshot({ name: 'new' }));
    expect(fresh.useHistoryStore.getState().sessions.map((session) => session.id)).toEqual(beforeIds);
  });
});

describe('history store storage event', () => {
  it('他タブ相当の storage イベントで rehydrate する', async () => {
    const spy = vi.spyOn(useHistoryStore.persist, 'rehydrate').mockResolvedValue();
    window.dispatchEvent(new StorageEvent('storage', { key: HISTORY_STORAGE_KEY, newValue: '{}' }));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('無関係な key の storage イベントでは rehydrate しない', () => {
    const spy = vi.spyOn(useHistoryStore.persist, 'rehydrate').mockResolvedValue();
    window.dispatchEvent(new StorageEvent('storage', { key: 'other-key', newValue: '{}' }));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
