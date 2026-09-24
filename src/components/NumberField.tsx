import { useEffect, useId, useState, type ReactNode } from 'react';
import { parseNumberInput } from '../lib/numberInput';

type Props = {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  placeholder?: string;
  hint?: ReactNode;
  className?: string;
};

/**
 * 数値入力欄。入力中の文字列はそのまま保持し（「0」が消える・「05」になる等を防ぐ）、
 * 読める値になった時点でストアへ反映、フォーカスが外れたら表示を整える。
 */
export function NumberField({ label, value, onCommit, placeholder = '0', hint, className = '' }: Props) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const invalid = parseNumberInput(text) === undefined;

  // 比較カードの「この価格を使う」など、外から値が変わったら表示を追従させる（入力中は上書きしない）。
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  return (
    <label htmlFor={id} className={`flex flex-col gap-1 text-xs text-ink/70 ${className}`}>
      {label}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        aria-invalid={invalid}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseNumberInput(e.target.value);
          if (parsed !== undefined) onCommit(parsed);
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = parseNumberInput(text);
          setText(String(parsed ?? value));
        }}
        className="glass-input num min-h-11 px-3 py-2 text-sm text-ink"
      />
      {invalid && <span className="text-[11px] text-rose-200">数字で入力してください</span>}
      {hint}
    </label>
  );
}
