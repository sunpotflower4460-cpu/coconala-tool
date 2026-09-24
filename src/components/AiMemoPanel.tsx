import { BotMessageSquare } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import { buildRuleBasedInsights } from '../features/ai/ruleBasedInsight';

export function AiMemoPanel() {
  const comparedCards = useResearchStore((s) => s.comparedCards);
  const profitSettings = useResearchStore((s) => s.profitSettings);
  const memos = buildRuleBasedInsights(comparedCards, profitSettings);

  // Show empty guidance only when the user has not yet entered any data at all
  const isEmpty = comparedCards.length === 0 && profitSettings.buyPrice === 0 && profitSettings.sellPrice === 0;

  return (
    <section className="glass border-violet-300/25 bg-violet-500/10 p-4">
      <div className="flex items-center gap-2">
        <BotMessageSquare size={15} className="text-violet-200" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-violet-100">ひとことメモ（自動チェック）</h2>
      </div>
      <p className="mt-1 text-xs text-violet-100/80">
        入力内容から注意点を自動で書き出します。断定ではないので、元ページも確認してください。
      </p>
      {isEmpty ? (
        <p className="mt-3 rounded-xl border border-dashed border-violet-200/20 p-3 text-xs text-violet-100/80">
          比較カードを追加するか、利益設定の仕入れ・販売価格を入力するとコメントが表示されます。
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {memos.map((memo) => (
            <li key={memo.id} className="rounded-xl border border-violet-200/20 bg-black/20 px-3 py-2 text-xs text-slate-200">
              {memo.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
