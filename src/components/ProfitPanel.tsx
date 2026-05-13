import { useResearchStore } from '../store/researchStore';

function calcProfit(
  sellPrice: number,
  buyPrice: number,
  shippingCost: number,
  feeRate: number,
): number {
  const fee = sellPrice * (feeRate / 100);
  return sellPrice - fee - buyPrice - shippingCost;
}

function profitBadge(profit: number, margin: number) {
  if (profit > 0 && margin >= 15) return { label: '狙い目', color: 'bg-emerald-500/80 text-white' };
  if (profit > 0) return { label: '要確認', color: 'bg-yellow-500/80 text-black' };
  return { label: '利益薄い', color: 'bg-red-500/80 text-white' };
}

export function ProfitPanel() {
  const { profitSettings, setProfitSettings, comparedCards } = useResearchStore();
  const { buyPrice, sellPrice, shippingCost, feeRate, exchangeRate } = profitSettings;

  const profit = calcProfit(sellPrice, buyPrice, shippingCost, feeRate);
  const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;
  const badge = profitBadge(profit, margin);

  const hasUsdCard = comparedCards.some((c) => c.currency === 'USD');

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-slate-300">利益見込み計算</h2>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          仕入れ価格 (円)
          <input
            type="number"
            value={buyPrice || ''}
            onChange={(e) => setProfitSettings({ buyPrice: Number(e.target.value) })}
            placeholder="0"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/60"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          販売価格 (円)
          <input
            type="number"
            value={sellPrice || ''}
            onChange={(e) => setProfitSettings({ sellPrice: Number(e.target.value) })}
            placeholder="0"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/60"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          送料 (円)
          <input
            type="number"
            value={shippingCost || ''}
            onChange={(e) => setProfitSettings({ shippingCost: Number(e.target.value) })}
            placeholder="0"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/60"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          手数料率 (%)
          <input
            type="number"
            value={feeRate || ''}
            onChange={(e) => setProfitSettings({ feeRate: Number(e.target.value) })}
            placeholder="10"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/60"
          />
        </label>
        {hasUsdCard && (
          <label className="col-span-2 flex flex-col gap-1 text-xs text-slate-400">
            ドル円レート
            <input
              type="number"
              value={exchangeRate || ''}
              onChange={(e) => setProfitSettings({ exchangeRate: Number(e.target.value) })}
              placeholder="155"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/60"
            />
          </label>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">利益見込み</span>
          <span className={`text-xl font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {profit >= 0 ? '+' : ''}{profit.toLocaleString()}円
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">利益率</span>
          <span className="text-sm text-slate-300">{margin.toFixed(1)}%</span>
        </div>
        <div className="flex justify-end mt-1">
          <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>
    </div>
  );
}
