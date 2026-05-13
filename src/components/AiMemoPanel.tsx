import { BotMessageSquare } from 'lucide-react';
import { useResearchStore } from '../store/researchStore';
import { buildRuleBasedInsights } from '../features/ai/ruleBasedInsight';

export function AiMemoPanel() {
  const { comparedCards, profitSettings } = useResearchStore();
  const memos = buildRuleBasedInsights(comparedCards, profitSettings);

  return (
    <section className="rounded-2xl border border-violet-300/20 bg-violet-500/5 p-4">
      <div className="flex items-center gap-2">
        <BotMessageSquare size={15} className="text-violet-200" />
        <h2 className="text-sm font-semibold text-violet-100">ルールベースAIメモ（APIコストなし）</h2>
      </div>
      <p className="mt-1 text-xs text-violet-100/80">
        参考用の短文コメントです。断定ではなく推定なので、元ページを確認してください。
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {memos.map((memo) => (
          <li key={memo.id} className="rounded-xl border border-violet-200/20 bg-black/20 px-3 py-2 text-xs text-slate-200">
            {memo.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
