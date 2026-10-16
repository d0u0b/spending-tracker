import { useLayoutEffect, useRef, useState } from 'react';

interface Props<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

/** 液態玻璃膠囊分段控制，選中項目以滑動的高光片表示 */
export function Segmented<T extends string>({ value, options, onChange, size = 'md', ariaLabel }: Props<T>) {
  const wrap = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = wrap.current?.querySelector<HTMLButtonElement>(`[data-value="${value}"]`);
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [value, options.length]);

  const pad = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm';

  return (
    <div ref={wrap} role="tablist" aria-label={ariaLabel} className="glass relative inline-flex rounded-full p-1">
      {pill && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-out"
          style={{
            left: pill.left,
            width: pill.width,
            background: 'var(--glass-active)',
            boxShadow: 'inset 1px 1px 0 -0.5px var(--glass-hl), 0 2px 8px rgb(0 0 0 / 0.08)',
          }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          data-value={o.value}
          onClick={() => onChange(o.value)}
          className={`relative z-10 rounded-full font-medium transition-colors ${pad} ${
            o.value === value ? 'text-fg' : 'text-fg-2 hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
