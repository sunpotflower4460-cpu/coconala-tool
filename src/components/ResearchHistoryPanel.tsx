import { useMemo, useState } from 'react';
import { FolderClock, Play, Save, Trash2 } from 'lucide-react';
import { useHistoryStore } from '../features/history/historyStore';
import { useResearchStore } from '../store/researchStore';

type Props = {
  onLoadSession?: () => void;
};

export function ResearchHistoryPanel({ onLoadSession }: Props) {
  const [name, setName] = useState('');
  const { sessions, saveSession, deleteSession } = useHistoryStore();
  const { query, resultCards, comparedCards, profitSettings, loadResearchSession } = useResearchStore();
  const hasData = resultCards.length > 0 || comparedCards.length > 0 || query.trim().length > 0;

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sessions],
  );

  function handleSave() {
    if (!hasData) return;
    saveSession({
      name: name.trim() || `${query || 'リサーチ'} ${new Date().toLocaleString()}`,
      query,
      resultCards,
      comparedCards,
      profitSettings,
    });
    setName('');
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2">
        <FolderClock size={15} className="text-slate-300" />
        <h2 className="text-sm font-semibold text-slate-200">リサーチ履歴</h2>
      </div>
      <p className="mt-1 text-xs text-slate-400">現在の結果を名前付きで保存し、あとで再開できます。</p>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="保存名（例: PS5 5月相場）"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-accent/60"
        />
        <button
          onClick={handleSave}
          disabled={!hasData}
          className="shrink-0 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
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
            <p className="text-[10px] text-slate-500">{new Date(session.updatedAt).toLocaleString()}</p>
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={() => {
                  loadResearchSession({
                    query: session.query,
                    resultCards: session.resultCards,
                    comparedCards: session.comparedCards,
                    profitSettings: session.profitSettings,
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
