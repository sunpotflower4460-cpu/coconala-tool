import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useResearchStore } from '../../store/researchStore';
import { createManualCard } from './manualCardFactory';
import { detectSiteNameFromUrl } from './siteDetector';
import { toSafeHttpUrl, toSafeHttpsUrl } from '../../lib/safeUrl';
import {
  MAX_CARD_CONDITION_TEXT_LENGTH,
  MAX_CARD_NOTE_LENGTH,
  MAX_CARD_PRICE_TEXT_LENGTH,
  MAX_CARD_SHIPPING_TEXT_LENGTH,
  MAX_CARD_SITE_NAME_LENGTH,
  MAX_CARD_TITLE_LENGTH,
  MAX_URL_LENGTH,
} from '../../lib/limits';

type Props = {
  onClose: () => void;
  onSuccess?: () => void;
};

function validateUrlText(value: string): string {
  if (!value.trim()) return 'URLを入力してください。';
  if (!toSafeHttpUrl(value)) {
    return 'http または https のURLを入力してください。';
  }
  return '';
}

function validateImageUrlText(value: string): string {
  if (!value.trim()) return '';
  if (!toSafeHttpsUrl(value)) {
    return '画像URLは https のみ利用できます。';
  }
  return '';
}

export function ManualAddPanel({ onClose, onSuccess }: Props) {
  const addManualCard = useResearchStore((s) => s.addManualCard);
  const resultCards = useResearchStore((s) => s.resultCards);
  const comparedCards = useResearchStore((s) => s.comparedCards);
  const titleId = useId();
  const urlErrorId = useId();
  const imageErrorId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ダイアログの基本操作: 開いたら URL 欄へフォーカス、Esc で閉じる、Tab はダイアログ内で循環、閉じたら元の場所へ戻す。
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, a[href]'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);
  const [form, setForm] = useState({
    title: '',
    siteName: '',
    pageUrl: '',
    priceText: '',
    currency: 'JPY' as 'JPY' | 'USD',
    shippingText: '',
    conditionText: '',
    imageUrl: '',
    note: '',
  });
  const [urlError, setUrlError] = useState('');
  const [imageUrlError, setImageUrlError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');

  function checkDuplicate(url: string) {
    const normalized = url.trim().replace(/\/+$/, '');
    if (!normalized) {
      setDuplicateWarning('');
      return;
    }
    const exists = [...resultCards, ...comparedCards].some(
      (c) => c.pageUrl.trim().replace(/\/+$/, '') === normalized,
    );
    setDuplicateWarning(exists ? '同じURLのカードがすでに存在します。別のURLを入力するか、そのまま追加できます。' : '');
  }

  function handleUrlBlur() {
    setUrlError(validateUrlText(form.pageUrl));
    checkDuplicate(form.pageUrl);
    if (form.pageUrl && !form.siteName) {
      const detected = detectSiteNameFromUrl(form.pageUrl);
      if (detected) setForm((f) => ({ ...f, siteName: detected }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const currentUrlError = validateUrlText(form.pageUrl);
    const currentImageError = validateImageUrlText(form.imageUrl);
    setUrlError(currentUrlError);
    setImageUrlError(currentImageError);
    if (currentUrlError || currentImageError) return;

    const card = createManualCard({
      title: form.title || undefined,
      siteName: form.siteName,
      pageUrl: form.pageUrl,
      priceText: form.priceText,
      currency: form.currency,
      shippingText: form.shippingText || undefined,
      conditionText: form.conditionText || undefined,
      imageUrl: form.imageUrl || undefined,
      note: form.note || undefined,
    });
    addManualCard(card);
    onSuccess?.();
    onClose();
  }

  const inputClass = 'glass-input w-full px-3 py-2 text-sm text-ink placeholder:text-ink/40';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass-modal my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto p-5 sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="font-display text-base font-semibold text-ink">手動で追加</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-11 w-11 items-center justify-center rounded-control text-ink/55 hover:bg-white/10 hover:text-ink transition"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-200">
            URL <span className="text-red-400">*</span>
            <input
              ref={firstFieldRef}
              required
              type="url"
              aria-invalid={Boolean(urlError)}
              aria-describedby={urlError ? urlErrorId : undefined}
              maxLength={MAX_URL_LENGTH}
              value={form.pageUrl}
              onChange={(e) => {
                const nextValue = e.target.value;
                setForm((f) => ({ ...f, pageUrl: nextValue }));
                if (urlError) setUrlError(validateUrlText(nextValue));
                if (duplicateWarning) checkDuplicate(nextValue);
              }}
              onBlur={handleUrlBlur}
              onPaste={(e) => {
                // URLを貼ったら、サイト名を自動で入れて価格欄へ進む（貼って・価格を打つだけで追加できる）。
                const pasted = e.clipboardData.getData('text').trim();
                if (!toSafeHttpUrl(pasted)) return;
                e.preventDefault();
                const detected = detectSiteNameFromUrl(pasted);
                setForm((f) => ({ ...f, pageUrl: pasted, siteName: f.siteName || detected }));
                setUrlError('');
                checkDuplicate(pasted);
                window.setTimeout(() => priceRef.current?.focus(), 0);
              }}
              placeholder="https://..."
              className={inputClass}
            />
            {urlError && (
              <span id={urlErrorId} role="alert" className="text-xs text-red-200">
                {urlError}
              </span>
            )}
            {!urlError && duplicateWarning && (
              <span className="text-xs text-amber-200">{duplicateWarning}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-200">
            タイトル（任意）
            <input
              type="text"
              maxLength={MAX_CARD_TITLE_LENGTH}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="空欄の場合はサイト名から自動生成されます"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-200">
            サイト名
            <input
              type="text"
              maxLength={MAX_CARD_SITE_NAME_LENGTH}
              value={form.siteName}
              onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))}
              placeholder="URLから自動検出されます"
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              価格
              <input
                ref={priceRef}
                type="text"
                maxLength={MAX_CARD_PRICE_TEXT_LENGTH}
                value={form.priceText}
                onChange={(e) => setForm((f) => ({ ...f, priceText: e.target.value }))}
                placeholder="例: ¥5,000"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              通貨
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as 'JPY' | 'USD' }))}
                aria-label="通貨"
                className={`${inputClass} w-20`}
              >
                <option value="JPY">JPY</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>
          {!form.priceText.trim() && (
            <span className="-mt-2 text-xs text-slate-300">価格を入力しないと「価格不明」と表示されます。「1.5万円」「¥12,800」のように書けます。</span>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              送料
              <input
                type="text"
                maxLength={MAX_CARD_SHIPPING_TEXT_LENGTH}
                value={form.shippingText}
                onChange={(e) => setForm((f) => ({ ...f, shippingText: e.target.value }))}
                placeholder="例: 送料無料"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-200">
              状態
              <input
                type="text"
                maxLength={MAX_CARD_CONDITION_TEXT_LENGTH}
                value={form.conditionText}
                onChange={(e) => setForm((f) => ({ ...f, conditionText: e.target.value }))}
                placeholder="例: 新品"
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-slate-200">
            画像URL（任意）
            <input
              type="url"
              maxLength={MAX_URL_LENGTH}
              aria-invalid={Boolean(imageUrlError)}
              aria-describedby={imageUrlError ? imageErrorId : undefined}
              value={form.imageUrl}
              onChange={(e) => {
                const nextValue = e.target.value;
                setForm((f) => ({ ...f, imageUrl: nextValue }));
                if (imageUrlError) setImageUrlError(validateImageUrlText(nextValue));
              }}
              placeholder="https://..."
              className={inputClass}
            />
            {imageUrlError && (
              <span id={imageErrorId} role="alert" className="text-xs text-red-200">
                {imageUrlError}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-200">
            メモ（任意）
            <textarea
              maxLength={MAX_CARD_NOTE_LENGTH}
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
            className="mt-2 min-h-11 rounded-xl bg-accent-strong px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            比較に追加
          </button>
        </form>
      </div>
    </div>
  );
}
