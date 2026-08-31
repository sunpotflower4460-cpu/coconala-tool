import { Component, type ErrorInfo, type ReactNode } from 'react';
import { HISTORY_STORAGE_KEY, RESEARCH_STORAGE_KEY } from '../lib/persistSanitize';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AppErrorBoundary caught', error, info);
  }

  handleReset = () => {
    try {
      localStorage.removeItem(RESEARCH_STORAGE_KEY);
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Storage が使えない環境でも再読み込みは行う。
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4 text-ink">
        <h1 className="font-display text-xl font-semibold">表示中に問題が起きました</h1>
        <p className="text-sm text-ink/70">
          保存データが壊れている可能性があります。保存データを消して再読み込みすると復旧できることがあります。比較ボードや履歴は消えます。
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          className="rounded-card bg-accent px-4 py-2.5 text-sm font-semibold text-white"
        >
          保存データを消して再読み込み
        </button>
      </main>
    );
  }
}
