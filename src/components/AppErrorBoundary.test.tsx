import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppErrorBoundary } from './AppErrorBoundary';
import { HISTORY_STORAGE_KEY, RESEARCH_STORAGE_KEY } from '../lib/persistSanitize';

function Boom(): never {
  throw new Error('render boom');
}

describe('AppErrorBoundary', () => {
  it('子の例外で白画面にせず復旧導線を出す', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: '表示中に問題が起きました' })).toBeVisible();
    expect(screen.getByRole('button', { name: '保存データを消して再読み込み' })).toBeVisible();
    spy.mockRestore();
  });

  it('復旧ボタンは保存キーを消してから reload する', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(RESEARCH_STORAGE_KEY, '{"state":{}}');
    localStorage.setItem(HISTORY_STORAGE_KEY, '{"state":{}}');
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });

    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    await userEvent.click(screen.getByRole('button', { name: '保存データを消して再読み込み' }));
    expect(localStorage.getItem(RESEARCH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
    expect(reload).toHaveBeenCalled();
    spy.mockRestore();
  });
});
