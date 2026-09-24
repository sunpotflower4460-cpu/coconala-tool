// 初回描画の前に保存済みテーマを当て、別テーマが一瞬表示される「ちらつき」を防ぐ。
// CSP（script-src 'self'）で許可されるよう、インラインではなく同一オリジンのファイルとして読み込む。
(function () {
  var themes = ['simple-pro', 'soft-market', 'dark-trader', 'natural-board'];
  var theme = 'simple-pro';
  try {
    var saved = JSON.parse(window.localStorage.getItem('coconala-tool-research') || 'null');
    if (saved && saved.state && themes.indexOf(saved.state.theme) !== -1) theme = saved.state.theme;
  } catch (e) {
    // 保存データが読めない・ストレージが使えない場合は既定テーマ
  }
  document.body.classList.add('theme-' + theme);
})();
