import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, CheckCircle2, Copy, ExternalLink, Loader2, X, XCircle } from 'lucide-react';
import { getDesktop, type KeySite, type KeyStatus, type KeyTestResult } from '../../lib/desktopBridge';
import { REGISTRATION_URLS } from '../../lib/desktopConfig';
import { useDesktopUi, type SetupStep } from './desktopUiStore';

const APP_NAME = '相場カード比較ボード';
const APP_DESCRIPTION =
  '物販リサーチ用の相場比較ツール。利用者が入力した商品名・型番・JANコードで商品を検索し、商品名・価格・画像・商品ページへのリンクを表示します。取得したデータは保存・再配布しません。';

const SITE_TITLES: Record<KeySite, string> = { rakuten: '楽天市場', yahoo: 'Yahoo!ショッピング', ebay: 'eBay' };

/** キーのテスト結果を、次にすることが分かる一文にする。 */
export function describeTest(site: KeySite, result: KeyTestResult, allowedHost: string): string {
  if (result.ok) return `使えます。${SITE_TITLES[site]}の商品をアプリで表示できる状態です。`;
  switch (result.code) {
    case 'no_key':
      return 'キーがまだ入っていません。下の欄に貼り付けて「保存してテスト」を押してください。';
    case 'upstream_auth':
      return site === 'rakuten'
        ? `キーが違うか、楽天の「許可されたWebサイト」に ${allowedHost} が入っていないようです。楽天のアプリ一覧で確認し、キーをコピーし直してください。`
        : 'キーが違うようです。登録ページでキーをコピーし直して、もう一度貼り付けてください。';
    case 'rate_limited':
      return '短時間に問い合わせが集中しました。1分ほど待ってから、もう一度「テスト」を押してください。';
    case 'timeout':
    case 'fetch_failed':
      return 'サイトに接続できませんでした。インターネットにつながっているか確認して、もう一度お試しください。';
    default:
      return 'サイト側で一時的な問題が起きているようです。時間をおいて、もう一度「テスト」を押してください。';
  }
}

function CopyRow({ label, value, note }: { label: string; value: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-control border border-white/10 bg-black/20 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink/80">{label}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
          aria-label={`${label}をコピー`}
          className="flex min-h-11 items-center gap-1 rounded-control border border-white/15 px-3 text-xs font-semibold hover:bg-white/10"
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? 'コピーしました' : 'コピー'}
        </button>
      </div>
      <p className="mt-1 break-all font-mono text-sm text-ink">{value}</p>
      {note && <p className="mt-1 text-xs text-ink/65">{note}</p>}
    </div>
  );
}

function Field({ label, value, onChange, secret = false, hint }: { label: string; value: string; onChange: (v: string) => void; secret?: boolean; hint?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        type={secret ? 'password' : 'text'}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-input h-11 px-3 font-mono text-sm text-ink"
      />
      {hint && <p className="text-xs text-ink/65">{hint}</p>}
    </div>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm leading-relaxed text-ink/90">{children}</ol>;
}

function OpenButton({ url, children }: { url: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => void getDesktop()?.openExternal(url)}
      className="mt-1 flex min-h-11 items-center gap-1.5 rounded-control border border-white/20 bg-white/10 px-3 text-sm font-semibold hover:bg-white/20"
    >
      <ExternalLink size={14} aria-hidden="true" />
      {children}
    </button>
  );
}

type TestState = { running: boolean; result: KeyTestResult | null };

function SaveAndTest({ site, canSave, onSave, status }: { site: KeySite; canSave: boolean; onSave: () => Promise<void>; status: KeyStatus | null }) {
  const [test, setTest] = useState<TestState>({ running: false, result: null });
  const allowedHost = status ? new URL(status.rakuten.allowedOrigin).host : '';
  const run = async (save: boolean) => {
    const desktop = getDesktop();
    if (!desktop) return;
    setTest({ running: true, result: null });
    if (save) await onSave();
    const result = await desktop.keys.test(site);
    setTest({ running: false, result });
  };
  const configured = status ? status[site].configured : false;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canSave || test.running}
          onClick={() => void run(true)}
          className="flex min-h-11 items-center gap-1.5 rounded-control bg-accent-strong px-4 text-sm font-bold text-on-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {test.running && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          保存してテスト
        </button>
        {configured && (
          <button
            type="button"
            disabled={test.running}
            onClick={() => void run(false)}
            className="min-h-11 rounded-control border border-white/20 px-4 text-sm font-semibold hover:bg-white/10"
          >
            保存済みのキーをテスト
          </button>
        )}
      </div>
      <div role="status" aria-live="polite">
        {test.result && (
          <p
            className={`flex items-start gap-1.5 rounded-control border px-3 py-2 text-sm ${
              test.result.ok ? 'border-emerald-300/40 bg-emerald-500/10' : 'border-amber-300/40 bg-amber-500/10'
            }`}
          >
            {test.result.ok ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
            ) : (
              <XCircle size={16} className="mt-0.5 shrink-0 text-amber-200" aria-hidden="true" />
            )}
            {describeTest(site, test.result, allowedHost)}
          </p>
        )}
      </div>
    </div>
  );
}

function RakutenStep({ status, onSaved }: { status: KeyStatus | null; onSaved: (s: KeyStatus) => void }) {
  const [appId, setAppId] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [expiresOn, setExpiresOn] = useState(status?.rakuten.expiresOn ?? '');
  const origin = status?.rakuten.allowedOrigin ?? '';
  const host = origin ? new URL(origin).host : '';
  return (
    <div className="flex flex-col gap-4">
      <Steps>
        <li>
          下のボタンで楽天の登録ページを開き、楽天会員でログインします（いつものブラウザで開きます）。
          <OpenButton url={REGISTRATION_URLS.rakuten}>楽天の登録ページを開く</OpenButton>
        </li>
        <li>
          登録ページの各欄に、次の内容を「コピー」して貼り付けます。
          <div className="mt-2 flex flex-col gap-2">
            <CopyRow label="アプリケーション名" value={APP_NAME} />
            <CopyRow label="アプリケーションURL" value={`${origin}/`} />
            <p className="rounded-control border border-white/10 bg-black/20 p-2.5 text-sm">
              <span className="text-xs font-semibold text-ink/80">アプリケーションタイプ</span>
              <br />「Webアプリケーション」を選びます。
            </p>
            <CopyRow label="許可されたWebサイト" value={host} note="例として薄く出ている文字は消してから貼り付けます。https:// は付けません。" />
            <CopyRow label="アプリケーションの説明" value={APP_DESCRIPTION} />
          </div>
        </li>
        <li>
          登録すると「アプリケーションID」と「アクセスキー」が表示されます。それぞれコピーして、下に貼り付けます。
        </li>
      </Steps>
      <Field label="アプリケーションID" value={appId} onChange={setAppId} />
      <Field label="アクセスキー" value={accessKey} onChange={setAccessKey} secret />
      <div className="flex flex-col gap-1">
        <label htmlFor="rakuten-expires" className="text-sm font-semibold text-ink">
          有効期限（任意）
        </label>
        <input
          id="rakuten-expires"
          type="date"
          value={expiresOn}
          onChange={(e) => setExpiresOn(e.target.value)}
          className="glass-input h-11 w-48 px-3 text-sm text-ink"
        />
        <p className="text-xs text-ink/65">楽天のアプリには約1年の有効期限があります。入れておくと、期限の30日前からアプリでお知らせします。</p>
      </div>
      <SaveAndTest
        site="rakuten"
        status={status}
        canSave={Boolean(appId.trim() && accessKey.trim())}
        onSave={async () => {
          const next = await getDesktop()?.keys.save({ rakuten: { appId, accessKey, expiresOn: expiresOn || undefined } });
          if (next) onSaved(next);
          setAppId('');
          setAccessKey('');
        }}
      />
    </div>
  );
}

function YahooStep({ status, onSaved }: { status: KeyStatus | null; onSaved: (s: KeyStatus) => void }) {
  const [clientId, setClientId] = useState('');
  const origin = status?.rakuten.allowedOrigin ?? '';
  return (
    <div className="flex flex-col gap-4">
      <Steps>
        <li>
          下のボタンで Yahoo!デベロッパーネットワークを開き、Yahoo! JAPAN ID でログインします。
          <OpenButton url={REGISTRATION_URLS.yahoo}>Yahoo! の登録ページを開く</OpenButton>
        </li>
        <li>
          次のように入力・選択します。
          <div className="mt-2 flex flex-col gap-2">
            <p className="rounded-control border border-white/10 bg-black/20 p-2.5 text-sm">
              <span className="text-xs font-semibold text-ink/80">アプリケーションの種類</span>
              <br />「クライアントサイド」を選びます。
            </p>
            <CopyRow label="アプリケーション名" value={APP_NAME} />
            <CopyRow label="サイトURL" value={`${origin}/`} />
            <CopyRow label="アプリケーションの説明" value={APP_DESCRIPTION} />
            <p className="rounded-control border border-white/10 bg-black/20 p-2.5 text-sm">
              ID連携は「利用しない」、利用者情報は「個人」、個人情報提供先への同意は「同意しない」のままで大丈夫です。規約に同意して登録します。
            </p>
          </div>
        </li>
        <li>登録後に表示される「Client ID」をコピーして、下に貼り付けます（シークレットは使いません）。</li>
      </Steps>
      <Field label="Client ID" value={clientId} onChange={setClientId} secret />
      <SaveAndTest
        site="yahoo"
        status={status}
        canSave={Boolean(clientId.trim())}
        onSave={async () => {
          const next = await getDesktop()?.keys.save({ yahoo: { clientId } });
          if (next) onSaved(next);
          setClientId('');
        }}
      />
    </div>
  );
}

function EbayStep({ status, onSaved }: { status: KeyStatus | null; onSaved: (s: KeyStatus) => void }) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-control border border-sky-300/30 bg-sky-500/10 p-3 text-sm">
        eBay（海外の相場）は、必要な人だけ設定すれば大丈夫です。開発者アカウントの承認に1営業日ほどかかります。
      </p>
      <Steps>
        <li>
          下のボタンで eBay の開発者ページを開き、アカウントを作ってログインします（eBay の通常アカウントでも可）。
          <OpenButton url={REGISTRATION_URLS.ebay}>eBay の開発者ページを開く</OpenButton>
        </li>
        <li>
          「Application Keys」で、Application Title に次を入れ、<b>Production</b> の列の「Create a keyset」を押します（Sandbox ではありません）。
          <div className="mt-2">
            <CopyRow label="Application Title" value="coconala-tool" />
          </div>
        </li>
        <li>
          「Marketplace Account Deletion」の設定を求められたら、「I do not persist eBay data」（eBay のデータを保存しない）を選んで免除（Exempted）にします。
        </li>
        <li>Production の「App ID (Client ID)」と「Cert ID (Client Secret)」をコピーして、下に貼り付けます。</li>
      </Steps>
      <Field label="App ID（Client ID）" value={clientId} onChange={setClientId} />
      <Field label="Cert ID（Client Secret）" value={clientSecret} onChange={setClientSecret} secret />
      <SaveAndTest
        site="ebay"
        status={status}
        canSave={Boolean(clientId.trim() && clientSecret.trim())}
        onSave={async () => {
          const next = await getDesktop()?.keys.save({ ebay: { clientId, clientSecret } });
          if (next) onSaved(next);
          setClientId('');
          setClientSecret('');
        }}
      />
    </div>
  );
}

const STEP_ORDER: SetupStep[] = ['overview', 'rakuten', 'yahoo', 'ebay'];
const STEP_LABELS: Record<SetupStep, string> = { overview: 'はじめに', rakuten: '楽天市場', yahoo: 'Yahoo!ショッピング', ebay: 'eBay（任意）' };

/** はじめての設定（キーの登録）。初回起動時と、画面右上の「設定」から開く。 */
export function SetupWizard() {
  const { setupOpen, setupStep, openSetup, closeSetup, keyStatus, setKeyStatus } = useDesktopUi();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!setupOpen) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSetup();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setupOpen, closeSetup]);

  if (!setupOpen) return null;
  const index = STEP_ORDER.indexOf(setupStep);
  const next = STEP_ORDER[index + 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="glass-modal flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden outline-none"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-5 py-3">
          <h2 id={titleId} className="font-display text-lg font-bold text-ink">
            設定 — {STEP_LABELS[setupStep]}
          </h2>
          <button type="button" onClick={closeSetup} aria-label="設定を閉じる" className="flex h-11 w-11 items-center justify-center rounded-control hover:bg-white/10">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="設定の手順" className="flex shrink-0 flex-wrap gap-1 border-b border-white/10 px-4 py-2">
          {STEP_ORDER.map((step, i) => {
            const done = step !== 'overview' && keyStatus?.[step].configured;
            return (
              <button
                key={step}
                type="button"
                aria-current={step === setupStep ? 'step' : undefined}
                onClick={() => openSetup(step)}
                className={`flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold ${
                  step === setupStep ? 'bg-accent-strong text-on-accent' : 'text-ink/80 hover:bg-white/10'
                }`}
              >
                <span className="num">{i + 1}.</span> {STEP_LABELS[step]}
                {done && <CheckCircle2 size={14} aria-label="設定済み" />}
              </button>
            );
          })}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {setupStep === 'overview' && (
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink/90">
              <p>
                楽天市場・Yahoo!ショッピング・eBay の商品を<b>画像つき</b>で自動表示するには、各サイトで無料の「キー」を登録して、このアプリに貼り付けます。
                1サイト5分ほどです。あとからでも「設定」ボタンでいつでも開けます。
              </p>
              <ul className="flex flex-col gap-1.5">
                {(['rakuten', 'yahoo', 'ebay'] as const).map((site) => (
                  <li key={site} className="flex items-center justify-between gap-2 rounded-control border border-white/10 bg-black/20 px-3 py-2">
                    <span className="font-semibold">{SITE_TITLES[site]}</span>
                    <span className="flex items-center gap-2">
                      <span className={keyStatus?.[site].configured ? 'text-emerald-200' : 'text-ink/70'}>
                        {keyStatus?.[site].configured ? '設定済み' : '未設定'}
                      </span>
                      <button type="button" onClick={() => openSetup(site)} className="min-h-11 rounded-control border border-white/20 px-3 font-semibold hover:bg-white/10">
                        {keyStatus?.[site].configured ? '変更・テスト' : '設定する'}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-ink/75">
                メルカリ・ヤフオク・ラクマ・Amazon はキーが要りません。「まとめて探す」で右側のタブに実際の検索ページが開き、
                「値段を取り込む」で一覧に加えられます。
              </p>
              {keyStatus && !keyStatus.encrypted && (
                <p className="rounded-control border border-amber-300/40 bg-amber-500/10 p-2.5 text-xs">
                  このパソコンではキーを暗号化して保存できないため、アプリを閉じるとキーは消えます（次回また貼り付けてください）。
                </p>
              )}
            </div>
          )}
          {setupStep === 'rakuten' && <RakutenStep status={keyStatus} onSaved={setKeyStatus} />}
          {setupStep === 'yahoo' && <YahooStep status={keyStatus} onSaved={setKeyStatus} />}
          {setupStep === 'ebay' && <EbayStep status={keyStatus} onSaved={setKeyStatus} />}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-5 py-3">
          <p className="text-xs text-ink/65">キーはこのパソコンの中だけに、暗号化して保存します。</p>
          <div className="flex gap-2">
            <button type="button" onClick={closeSetup} className="min-h-11 rounded-control border border-white/20 px-4 text-sm font-semibold hover:bg-white/10">
              {setupStep === 'overview' ? 'あとで設定する' : '閉じる'}
            </button>
            {next && (
              <button type="button" onClick={() => openSetup(next)} className="min-h-11 rounded-control bg-accent-strong px-4 text-sm font-bold text-on-accent">
                次へ（{STEP_LABELS[next]}）
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
