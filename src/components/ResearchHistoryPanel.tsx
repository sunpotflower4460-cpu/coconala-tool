import { useMemo, useState } from 'react';
import { AlertTriangle, FolderClock, Play, Save, Trash2 } from 'lucide-react';
import { useHistoryStore, MAX_SESSIONS, wasSessionPersisted } from '../features/history/historyStore';
import { useResearchStore } from '../store/researchStore';
import { DATA_SOURCE_MODE_LABELS, SEARCH_STATUS_LABELS } from '../types/market';

type Props = {
  onLoadSession?: () => void;
};

export function ResearchHistoryPanel({ onLoadSession }: Props) {
  const [name, setName] = useState('');
  const [saveError, setSaveError] = useState('');
  const { sessions, saveSession, deleteSession } = useHistoryStore();
  const { query, resultCards, comparedCards, profitSettings, dataSourceMode, searchStatus, searchWarnings, lastSearchedAt, loadResearchSession } =
    useResearchStore();
  const hasData = resultCards.length > 0 || comparedCards.length > 0 || query.trim().length > 0;

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sessions],
  );

  function handleSave() {
    if (!hasData) return;
    const saved = saveSession({
      name: name.trim() || `${query || 'リサーチ'} ${new Date().toLocaleString()}`,
      query,
      resultCards,
      comparedCards,
      profitSettings,
      dataSourceMode,
      searchStatus,
      searchWarnings,
      lastSearchedAt,
    });

    if (wasSessionPersisted(saved.id)) {
      setName('');
      setSaveError('');
    } else {
      setSaveError(
        '履歴の保存に失敗しました。ブラウザの保存容量が上限に達している可能性があります。不要な履歴を削除してからお試しください。',
      );
    }
  }

  return (
    <section className="glass p-4">
      <div className="flex items-center gap-2">
        <FolderClock size={15} className="text-ink/70" />
        <h2 className="font-display text-sm font-semibold text-ink/80">リサーチ履歴</h2>
      </div>
      <p className="mt-1 text-xs text-ink/60">
        現在の結果を名前付きで保存し、あとで再開できます。最大{MAX_SESSIONS}件まで保存され、超過分は古い履歴から自動的に削除されます。
      </p>

      {saveError && (
        <p className="mt-2 flex items-start gap-1.5 rounded-control border border-rose-400/30 bg-rose-500/10 p-2 text-[11px] text-rose-100">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {saveError}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="保存名（例: PS5 5月相場）"
          aria-label="保存名"
          className="glass-input w-full px-3 py-2 text-xs text-ink placeholder:text-ink/40"
        />
        <button
          onClick={handleSave}
          disabled={!hasData}
          className="shrink-0 rounded-control border border-white/12 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="inline-flex items-center gap-1">
            <Save size={12} />
            保存
          </span>
        </button>
      </div>

      <div className="mt-3 flex max-h-56 flex-col gap-2 overflow-auto pr-1">
        {sortedSessions.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/15 p-3 text-xs text-slate-400">
            まだ履歴がありません。
          </p>
        )}
        {sortedSessions.map((session) => (
          <div key={session.id} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
            <p className="truncate text-xs font-semibold text-slate-200">{session.name}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {session.query || 'クエリなし'} / 比較 {session.comparedCards.length} 件
            </p>
            <p className="text-[10px] text-slate-500">
              保存時のデータ: {DATA_SOURCE_MODE_LABELS[session.dataSourceMode]}
              {session.searchStatus ? `（${SEARCH_STATUS_LABELS[session.searchStatus]}）` : ''}
            </p>
            <p className="text-[10px] text-slate-500">{new Date(session.updatedAt).toLocaleString()}</p>
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={() => {
                  loadResearchSession({
                    query: session.query,
                    resultCards: session.resultCards,
                    comparedCards: session.comparedCards,
                    profitSettings: session.profitSettings,
                    dataSourceMode: session.dataSourceMode,
                  });
                  onLoadSession?.();
                }}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] hover:bg-white/10"
              >
                <Play size={11} />
                再開
              </button>
              <button
                onClick={() => deleteSession(session.id)}
                className="flex items-center gap-1 rounded-full border border-red-300/20 bg-red-400/10 px-2.5 py-1 text-[10px] text-red-200 hover:bg-red-400/20"
              >
                <Trash2 size={11} />
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
