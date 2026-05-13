import { useState } from 'react';
import { X } from 'lucide-react';
import { useResearchStore } from '../../store/researchStore';
import { createManualCard } from './manualCardFactory';
import { detectSiteNameFromUrl } from './siteDetector';

type Props = {
  onClose: () => void;
};

export function ManualAddPanel({ onClose }: Props) {
  const { addManualCard } = useResearchStore();
  const [form, setForm] = useState({
    siteName: '',
    pageUrl: '',
    priceText: '',
    shippingText: '',
    conditionText: '',
    imageUrl: '',
    note: '',
  });

  function handleUrlBlur() {
    if (form.pageUrl && !form.siteName) {
      const detected = detectSiteNameFromUrl(form.pageUrl);
      if (detected) setForm((f) => ({ ...f, siteName: detected }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.pageUrl) return;
    const card = createManualCard({
      siteName: form.siteName,
      pageUrl: form.pageUrl,
      priceText: form.priceText,
      shippingText: form.shippingText || undefined,
      conditionText: form.conditionText || undefined,
      imageUrl: form.imageUrl || undefined,
      note: form.note || undefined,
    });
    addManualCard(card);
    onClose();
  }

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent/60';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">手動で追加</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            URL <span className="text-red-400">*</span>
            <input
              required
              type="url"
              value={form.pageUrl}
              onChange={(e) => setForm((f) => ({ ...f, pageUrl: e.target.value }))}
              onBlur={handleUrlBlur}
              placeholder="https://..."
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-400">
            サイト名
            <input
              type="text"
              value={form.siteName}
              onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))}
              placeholder="URLから自動検出されます"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-400">
            価格
            <input
              type="text"
              value={form.priceText}
              onChange={(e) => setForm((f) => ({ ...f, priceText: e.target.value }))}
              placeholder="例: ¥5,000"
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              送料
              <input
                type="text"
                value={form.shippingText}
                onChange={(e) => setForm((f) => ({ ...f, shippingText: e.target.value }))}
                placeholder="例: 送料無料"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              状態
              <input
                type="text"
                value={form.conditionText}
                onChange={(e) => setForm((f) => ({ ...f, conditionText: e.target.value }))}
                placeholder="例: 新品"
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-slate-400">
            画像URL（任意）
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              placeholder="https://..."
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-400">
            メモ（任意）
            <textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="気づいた点など"
              rows={2}
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            disabled={!form.pageUrl}
            className="mt-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            比較に追加
          </button>
        </form>
      </div>
    </div>
  );
}
