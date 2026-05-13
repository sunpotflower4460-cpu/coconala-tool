import { useResearchStore } from '../store/researchStore';
import { calcFee, calcMargin, calcProfit, profitBadge } from '../features/profit/profitCalculator';

export function ProfitPanel() {
  const { profitSettings, setProfitSettings, comparedCards } = useResearchStore();
  const { buyPrice, sellPrice, shippingCost, feeRate, exchangeRate } = profitSettings;

  const profit = calcProfit(sellPrice, buyPrice, shippingCost, feeRate);
  const fee = calcFee(sellPrice, feeRate);
  const margin = calcMargin(profit, sellPrice);
  const badge = profitBadge(profit, margin);

  const hasForeignCard = comparedCards.some((c) => c.currency && c.currency !== 'JPY');
  const hasComparedCards = comparedCards.length > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-slate-300">利益見込み計算</h2>
      {!hasComparedCards && (
        <div className="rounded-xl border border-dashed border-white/15 bg-black/10 p-3 text-xs text-slate-400">
          まずは価格カードの「比較に追加」を押すと、ここに利益計算の候補をすぐ反映できます。
        </div>
      )}

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
        {hasForeignCard && (
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
        <p className="mt-2 text-xs text-slate-400">
          {sellPrice.toLocaleString()} - {fee.toLocaleString()} - {buyPrice.toLocaleString()} - {shippingCost.toLocaleString()} ={' '}
          {profit.toLocaleString()}円
        </p>
        <p className="text-[11px] text-slate-500">販売価格 - 手数料 - 仕入れ価格 - 送料 = 利益</p>
        <div className="flex justify-end mt-1">
          <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        ※ 利益見込みは推定です。最終判断は元ページの価格・送料・状態をご確認ください。
      </p>
    </div>
  );
}
