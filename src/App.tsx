function App() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
        <p className="mb-3 text-sm font-medium text-emerald-200">Market Card Research App</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Coconala Tool</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200">
          商品名を入れて、まとめて探す。画像つき価格カードで相場を見て、比較に追加し、利益を見るためのリサーチ補助ツールです。
        </p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/80 p-5">
          <p className="text-sm text-slate-300">Next implementation target:</p>
          <p className="mt-2 text-lg font-semibold">商品名入力 → まとめて探す → 価格カード → 比較 → 利益表示 → テーマ切替</p>
        </div>
      </section>
    </main>
  );
}

export default App;
