import { useShallow } from 'zustand/react/shallow';
import { useResearchStore } from '../store/researchStore';
import { NumberField } from './NumberField';
import { calcFee, calcMargin, calcProfit, profitBadge } from '../features/profit/profitCalculator';

export function ProfitPanel() {
  const { profitSettings, setProfitSettings, comparedCards, buyPriceSource, sellPriceSource } = useResearchStore(
    useShallow((s) => ({
      profitSettings: s.profitSettings,
      setProfitSettings: s.setProfitSettings,
      comparedCards: s.comparedCards,
      buyPriceSource: s.buyPriceSource,
      sellPriceSource: s.sellPriceSource,
    })),
  );
  const { buyPrice = 0, sellPrice = 0, shippingCost = 0, feeRate = 10, exchangeRate = 155 } =
    profitSettings ?? {};

  const profit = calcProfit(sellPrice, buyPrice, shippingCost, feeRate);
  const fee = calcFee(sellPrice, feeRate);
  const margin = calcMargin(profit, sellPrice);
  const displayProfit = Number.isFinite(profit) ? profit : 0;
  const displayFee = Number.isFinite(fee) ? fee : 0;
  const displayMargin = Number.isFinite(margin) ? margin : 0;
  const badge = profitBadge(displayProfit, displayMargin);

  const hasUsdCard = comparedCards.some((c) => c.currency === 'USD');
  const hasComparedCards = comparedCards.length > 0;

  return (
    <div className="glass p-5 flex flex-col gap-4">
      <h2 className="font-display text-sm font-semibold text-ink/80">利益見込み計算</h2>
      {!hasComparedCards && (
        <div className="rounded-card border border-dashed border-white/15 bg-black/10 p-3 text-xs text-ink/65">
          まずは価格カードの「比較に追加」を押すと、ここに利益計算の候補をすぐ反映できます。
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="仕入れ価格 (円)"
          value={buyPrice}
          onCommit={(v) => setProfitSettings({ buyPrice: v })}
          hint={
            buyPriceSource && (
              <span className="truncate text-[11px] text-ink/60" title={buyPriceSource}>
                由来: {buyPriceSource}
              </span>
            )
          }
        />
        <NumberField
          label="販売価格 (円)"
          value={sellPrice}
          onCommit={(v) => setProfitSettings({ sellPrice: v })}
          hint={
            sellPriceSource && (
              <span className="truncate text-[11px] text-ink/60" title={sellPriceSource}>
                由来: {sellPriceSource}
              </span>
            )
          }
        />
        <NumberField label="送料 (円)" value={shippingCost} onCommit={(v) => setProfitSettings({ shippingCost: v })} />
        <NumberField label="手数料率 (%)" value={feeRate} placeholder="10" onCommit={(v) => setProfitSettings({ feeRate: v })} />
        {hasUsdCard && (
          <NumberField
            className="col-span-2"
            label="ドル円レート（1ドル＝何円）"
            value={exchangeRate}
            placeholder="155"
            onCommit={(v) => setProfitSettings({ exchangeRate: v })}
          />
        )}
      </div>

      <div className="rounded-card border border-white/10 bg-black/15 p-4 flex flex-col gap-2">
        <div className="flex items-end justify-between gap-2">
          <span className="text-xs text-ink/60">利益見込み</span>
          <span className={`num text-3xl font-bold tracking-tight ${displayProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {displayProfit >= 0 ? '+' : ''}{displayProfit.toLocaleString('ja-JP')}<span className="ml-0.5 text-base font-semibold">円</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink/60">利益率</span>
          <span className="num text-sm text-ink/80">{displayMargin.toFixed(1)}%</span>
        </div>
        <p className="num mt-1 text-xs text-ink/55">
          {sellPrice.toLocaleString('ja-JP')} - {displayFee.toLocaleString('ja-JP')} - {buyPrice.toLocaleString('ja-JP')} -{' '}
          {shippingCost.toLocaleString('ja-JP')} = {displayProfit.toLocaleString('ja-JP')}円
        </p>
        <p className="text-[11px] text-ink/60">販売価格 - 手数料（1円未満切り捨て） - 仕入れ価格 - 送料 = 利益</p>
        {/* 販売価格が未入力のうちは判定バッジを出さない（未入力で「利益薄い」と決めつけない） */}
        {sellPrice > 0 && (
          <div className="flex justify-end mt-1">
            <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${badge.color}`}>
              {badge.label}
            </span>
          </div>
        )}
      </div>
      <p className="text-[11px] text-ink/60">
        ※ 利益見込みは推定です。最終判断は元ページの価格・送料・状態をご確認ください。
        消費税・関税等は含まれません。手数料は率（%）のみで、固定手数料（取引ごとの定額費用）は含まれません。
        該当する場合は送料や仕入れ価格に加算してください。
      </p>
    </div>
  );
}
