import { useResearchStore } from '../store/researchStore';
import { calcFee, calcMargin, calcProfit, profitBadge } from '../features/profit/profitCalculator';

export function ProfitPanel() {
  const { profitSettings, setProfitSettings, comparedCards, buyPriceSource, sellPriceSource } = useResearchStore();
  const { buyPrice, sellPrice, shippingCost, feeRate, exchangeRate } = profitSettings;

  const profit = calcProfit(sellPrice, buyPrice, shippingCost, feeRate);
  const fee = calcFee(sellPrice, feeRate);
  const margin = calcMargin(profit, sellPrice);
  const badge = profitBadge(profit, margin);

  const hasForeignCard = comparedCards.some((c) => c.currency && c.currency !== 'JPY');
  const hasComparedCards = comparedCards.length > 0;

  return (
    <div className="glass p-5 flex flex-col gap-4">
      <h2 className="font-display text-sm font-semibold text-ink/80">利益見込み計算</h2>
      {!hasComparedCards && (
        <div className="rounded-card border border-dashed border-white/15 bg-black/10 p-3 text-xs text-ink/55">
          まずは価格カードの「比較に追加」を押すと、ここに利益計算の候補をすぐ反映できます。
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink/60">
          仕入れ価格 (円)
          <input
            type="number"
            min={0}
            value={buyPrice || ''}
            onChange={(e) => setProfitSettings({ buyPrice: Number(e.target.value) })}
            placeholder="0"
            className="glass-input num px-3 py-2 text-sm text-ink"
          />
          {buyPriceSource && (
            <span className="truncate text-[10px] text-ink/45" title={buyPriceSource}>
              由来: {buyPriceSource}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink/60">
          販売価格 (円)
          <input
            type="number"
            min={0}
            value={sellPrice || ''}
            onChange={(e) => setProfitSettings({ sellPrice: Number(e.target.value) })}
            placeholder="0"
            className="glass-input num px-3 py-2 text-sm text-ink"
          />
          {sellPriceSource && (
            <span className="truncate text-[10px] text-ink/45" title={sellPriceSource}>
              由来: {sellPriceSource}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink/60">
          送料 (円)
          <input
            type="number"
            min={0}
            value={shippingCost || ''}
            onChange={(e) => setProfitSettings({ shippingCost: Number(e.target.value) })}
            placeholder="0"
            className="glass-input num px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink/60">
          手数料率 (%)
          <input
            type="number"
            min={0}
            max={100}
            value={feeRate || ''}
            onChange={(e) => setProfitSettings({ feeRate: Number(e.target.value) })}
            placeholder="10"
            className="glass-input num px-3 py-2 text-sm text-ink"
          />
        </label>
        {hasForeignCard && (
          <label className="col-span-2 flex flex-col gap-1 text-xs text-ink/60">
            ドル円レート
            <input
              type="number"
              min={0}
              value={exchangeRate || ''}
              onChange={(e) => setProfitSettings({ exchangeRate: Number(e.target.value) })}
              placeholder="155"
              className="glass-input num px-3 py-2 text-sm text-ink"
            />
          </label>
        )}
      </div>

      <div className="rounded-card border border-white/10 bg-black/15 p-4 flex flex-col gap-2">
        <div className="flex items-end justify-between gap-2">
          <span className="text-xs text-ink/60">利益見込み</span>
          <span className={`num text-3xl font-bold tracking-tight ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {profit >= 0 ? '+' : ''}{profit.toLocaleString('ja-JP')}<span className="ml-0.5 text-base font-semibold">円</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink/60">利益率</span>
          <span className="num text-sm text-ink/80">{margin.toFixed(1)}%</span>
        </div>
        <p className="num mt-1 text-xs text-ink/55">
          {sellPrice.toLocaleString('ja-JP')} - {fee.toLocaleString('ja-JP')} - {buyPrice.toLocaleString('ja-JP')} -{' '}
          {shippingCost.toLocaleString('ja-JP')} = {profit.toLocaleString('ja-JP')}円
        </p>
        <p className="text-[11px] text-ink/45">販売価格 - 手数料 - 仕入れ価格 - 送料 = 利益</p>
        <div className="flex justify-end mt-1">
          <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>
      <p className="text-[11px] text-ink/45">
        ※ 利益見込みは推定です。最終判断は元ページの価格・送料・状態をご確認ください。
        消費税・関税等は含まれません。手数料は率（%）のみで、固定手数料（取引ごとの定額費用）は含まれません。
        該当する場合は送料や仕入れ価格に加算してください。
      </p>
    </div>
  );
}
