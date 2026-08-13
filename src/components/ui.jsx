/** Shared visual primitives. Everything is inline SVG or CSS — no icon deps. */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* ────────────────────────────────  Icons  ──────────────────────────────── */

const P = ({ d }) => <path d={d} strokeLinecap="round" strokeLinejoin="round" />;

export const Icon = ({ name, className = 'size-5', ...rest }) => {
  const shapes = {
    home:      <><P d="M3 10.5 12 3l9 7.5" /><P d="M5.5 9.5V20a1 1 0 0 0 1 1H9.5v-5.5h5V21h3a1 1 0 0 0 1-1V9.5" /></>,
    plate:     <><P d="M6 3v6.5a2.2 2.2 0 0 0 4.4 0V3M8.2 9.5V21" /><P d="M17.8 3c-1.6 1.4-2.3 3.6-2.3 5.5 0 1.4.8 2.2 2.3 2.4V21" /></>,
    dumbbell:  <><P d="M6.5 8v8M3.5 10v4M17.5 8v8M20.5 10v4M6.5 12h11" /></>,
    leaf:      <><P d="M4 20c0-8 6-14 16-15 0 10-5 15-13 15H4z" /><P d="M9 15c1.5-3 4-5.5 7-7" /></>,
    spark:     <><P d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5" /><circle cx="12" cy="12" r="3.5" /></>,
    chart:     <><P d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    user:      <><circle cx="12" cy="8" r="4" /><P d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    plus:      <P d="M12 5v14M5 12h14" />,
    minus:     <P d="M5 12h14" />,
    x:         <P d="M6 6l12 12M18 6L6 18" />,
    check:     <P d="M4.5 12.5l5 5 10-11" />,
    chevL:     <P d="M15 5l-7 7 7 7" />,
    chevR:     <P d="M9 5l7 7-7 7" />,
    chevD:     <P d="M5 9l7 7 7-7" />,
    search:    <><circle cx="11" cy="11" r="6.5" /><P d="M16 16l4.5 4.5" /></>,
    flame:     <><P d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 11 10 11c0-3 2-8 2-8z" /></>,
    drop:      <P d="M12 3.5s6 6.4 6 10.4a6 6 0 0 1-12 0c0-4 6-10.4 6-10.4z" />,
    trash:     <><P d="M4 7h16M9.5 7V5h5v2M6.5 7l1 13h9l1-13" /></>,
    settings:  <><circle cx="12" cy="12" r="3" /><P d="M12 2v3M12 19v3M22 12h-3M5 12H2M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6" /></>,
    send:      <P d="M4 12l16-8-6 8 6 8-16-8z" />,
    calendar:  <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><P d="M3.5 10h17M8 3v4M16 3v4" /></>,
    target:    <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" /></>,
    scale:     <><P d="M12 4v16M6 20h12" /><P d="M4 9h16l-3 5H7L4 9z" /></>,
    book:      <><P d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15z" /><P d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z" /></>,
    bolt:      <P d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
    copy:      <><rect x="9" y="9" width="11" height="11" rx="2" /><P d="M15 5.5A1.5 1.5 0 0 0 13.5 4H5.5A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15" /></>,
    save:      <><P d="M5 4h11l3 3v13H5z" /><P d="M8 4v6h7V4M8 20v-6h8v6" /></>,
    info:      <><circle cx="12" cy="12" r="8.5" /><P d="M12 11v5.5M12 8h.01" /></>,
    alert:     <><P d="M12 3.5 21 19H3l9-15.5z" /><P d="M12 10v4M12 17h.01" /></>,
    sun:       <><circle cx="12" cy="12" r="4" /><P d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>,
    moon:      <P d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
    clock:     <><circle cx="12" cy="12" r="8.5" /><P d="M12 7.5V12l3 2" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
         className={className} aria-hidden="true" {...rest}>
      {shapes[name] ?? shapes.info}
    </svg>
  );
};

/* ────────────────────────────────  Layout  ─────────────────────────────── */

export function Card({ className = '', children, glow = false, ...rest }) {
  return (
    <div
      className={`surface rounded-3xl relative overflow-hidden ${className}`}
      {...rest}
    >
      {glow && (
        <div className="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full blur-3xl"
             style={{ background: 'radial-gradient(circle, rgb(16 185 129 / 0.22), transparent 70%)' }} />
      )}
      {children}
    </div>
  );
}

export function SectionTitle({ icon, children, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-dim">
        {icon && <Icon name={icon} className="size-4" />}
        {children}
      </h2>
      {action}
    </div>
  );
}

/* ────────────────────────────────  Buttons  ────────────────────────────── */

const VARIANTS = {
  primary:
    'metal hover:brightness-[1.08] font-semibold',
  ghost:
    'surface hover:[background:var(--surface-hover)] text-[color:var(--text)]',
  subtle:
    'bg-transparent hover:[background:var(--surface)] text-dim hover:text-[color:var(--text)]',
  danger:
    'bg-rose-500/12 text-bad hover:bg-rose-500/20 border border-rose-500/25',
};

export function Button({ variant = 'ghost', className = '', size = 'md', children, ...rest }) {
  const sizes = { sm: 'px-3 py-1.5 text-[13px] rounded-xl', md: 'px-4 py-2.5 text-sm rounded-2xl', lg: 'px-6 py-3.5 text-[15px] rounded-2xl' };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-all duration-200
                  active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none
                  ${sizes[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({ name, label, className = '', ...rest }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`grid place-items-center size-9 rounded-xl text-dim transition-all
                  hover:[background:var(--surface-hover)] hover:text-[color:var(--text)]
                  active:scale-90 ${className}`}
      {...rest}
    >
      <Icon name={name} className="size-[18px]" />
    </button>
  );
}

/* ────────────────────────────────  Inputs  ─────────────────────────────── */

export function Field({ label, hint, suffix, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="block text-[12px] font-medium text-dim mb-1.5">{label}</span>}
      <div className="relative">
        {children}
        {suffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] text-faint pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <span className="block text-[11px] text-faint mt-1.5">{hint}</span>}
    </label>
  );
}

const inputBase =
  'w-full px-3.5 py-2.5 rounded-2xl text-sm outline-none transition-all ' +
  'bg-[color:var(--surface)] border border-hair ' +
  'focus:border-brand-400/60 focus:ring-4 focus:ring-brand-400/10 placeholder:text-[color:var(--text-faint)]';

export const Input = ({ className = '', ...rest }) => <input className={`${inputBase} ${className}`} {...rest} />;

/**
 * A numeric field that behaves the way people expect.
 *
 * The obvious implementation — `value={number}` with `onChange={Number(...)}`
 * — is subtly broken: clearing the box produces `Number('') === 0`, React
 * re-renders it as "0", and typing 85 leaves you staring at "085". You also
 * cannot ever have an empty field, so correcting a value means selecting the
 * text first.
 *
 * The fix is to keep a *string* draft for as long as the field has focus, so
 * "", "-", "8" and "8." are all legal intermediate states, and only reconcile
 * to a number on blur. The parent still gets live updates for every keystroke
 * that parses, so dependent numbers keep moving as you type.
 *
 * Uses `inputMode="decimal"` rather than `type="number"`, which additionally
 * kills the leading-zero problem at the source and still brings up a numeric
 * keypad on mobile.
 */
export function NumberInput({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  fallback = 0,
  decimals = null,
  allowEmpty = false,
  unstyled = false,
  className = '',
  ...rest
}) {
  const [draft, setDraft] = useState(null); // null → not editing, mirror `value`

  const shown =
    draft !== null ? draft : value === null || value === undefined || value === '' ? '' : String(value);

  const handleChange = (e) => {
    const raw = e.target.value;
    // Accept anything on the way to a number, including partial input.
    if (raw !== '' && raw !== '-' && !/^-?\d*\.?\d*$/.test(raw)) return;

    setDraft(raw);

    if (raw === '' || raw === '-' || raw.endsWith('.')) {
      // Not yet a number. Hold the parent's last good value rather than
      // pushing 0, which is what caused the "085" behaviour.
      if (raw === '' && allowEmpty) onChange(null);
      return;
    }
    const n = Number(raw);
    if (!Number.isNaN(n)) onChange(n);
  };

  const handleBlur = () => {
    if (draft === null) return;

    if (draft === '' || draft === '-') {
      onChange(allowEmpty ? null : fallback);
      setDraft(null);
      return;
    }

    let n = Number(draft);
    if (Number.isNaN(n)) n = fallback;
    n = Math.min(max, Math.max(min, n));
    if (decimals !== null) n = Number(n.toFixed(decimals));

    onChange(n);
    setDraft(null); // fall back to mirroring `value`, which strips "007" → "7"
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={shown}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={(e) => e.target.select()}
      className={unstyled ? className : `${inputBase} ${className}`}
      {...rest}
    />
  );
}
export const Textarea = ({ className = '', ...rest }) => <textarea className={`${inputBase} resize-none ${className}`} {...rest} />;

export function Select({ className = '', children, ...rest }) {
  return (
    <div className="relative">
      <select className={`${inputBase} appearance-none pr-9 ${className}`} {...rest}>{children}</select>
      <Icon name="chevD" className="size-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-faint" />
    </div>
  );
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex p-1 rounded-2xl surface gap-1 ${className}`} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative px-3.5 py-1.5 rounded-xl text-[13px] font-medium transition-all duration-200 whitespace-nowrap
                        ${active
                          ? 'metal '
                          : 'text-dim hover:text-[color:var(--text)]'}`}
          >
            {o.icon && <span className="mr-1">{o.icon}</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ active, children, className = '', ...rest }) {
  return (
    <button
      className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-all active:scale-95
                  ${active
                    ? 'bg-brand-500/18 text-good border border-brand-400/35'
                    : 'surface text-dim hover:text-[color:var(--text)]'} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Stepper({ value, onChange, step = 5, min = 0, max = 5000, unit = 'g' }) {
  return (
    <div className="inline-flex items-center gap-1 surface rounded-2xl p-1">
      <IconButton name="minus" label="Decrease" onClick={() => onChange(Math.max(min, value - step))} className="size-8" />
      <NumberInput
        unstyled
        value={Math.round(value)}
        min={min} max={max} fallback={min}
        onChange={onChange}
        className="w-14 text-center bg-transparent outline-none text-sm font-semibold tabular"
      />
      <span className="text-[11px] text-faint pr-1">{unit}</span>
      <IconButton name="plus" label="Increase" onClick={() => onChange(Math.min(max, value + step))} className="size-8" />
    </div>
  );
}

/* ────────────────────────────────  Progress  ───────────────────────────── */

/** Big animated progress ring used for the calorie dial. */
export function Ring({ value, max, size = 200, stroke = 14, children, over = false }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const raw = max > 0 ? value / max : 0;
  const clamped = Math.min(1, Math.max(0, raw));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const gid = `ring-${size}-${over ? 'o' : 'n'}`;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            {over ? (
              <><stop offset="0%" stopColor="#fb923c" /><stop offset="100%" stopColor="#f43f5e" /></>
            ) : (
              <>
                <stop offset="0%" stopColor="var(--ring-a)" />
                <stop offset="55%" stopColor="var(--ring-b)" />
                <stop offset="100%" stopColor="var(--ring-c)" />
              </>
            )}
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#${gid})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown)}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Horizontal bar for macros and nutrients. `limit` inverts the colour logic. */
export function Bar({ value, target, unit = '', label, sub, limit = false, compact = false }) {
  const p = target > 0 ? (value / target) * 100 : 0;
  const width = Math.min(100, p);

  let tone;
  if (limit) tone = p > 110 ? 'bad' : p > 90 ? 'warn' : 'good';
  else tone = p >= 90 ? 'good' : p >= 50 ? 'warn' : 'low';

  const colors = {
    good: 'from-brand-300 to-brand-500',
    warn: 'from-amber-300 to-amber-500',
    low:  'from-slate-400/70 to-slate-500/70',
    bad:  'from-rose-400 to-rose-600',
  };
  const dot = { good: 'text-good', warn: 'text-warn', low: 'text-slate-400', bad: 'text-bad' };

  return (
    <div className={compact ? 'py-1.5' : 'py-2'}>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className={`${compact ? 'text-[12.5px]' : 'text-sm'} font-medium truncate`}>{label}</span>
        <span className="text-[12px] tabular text-dim shrink-0">
          <span className={dot[tone]}>{fmt(value)}</span>
          <span className="text-faint"> / {fmt(target)}{unit}</span>
          <span className="text-faint ml-1.5">{Math.round(p)}%</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colors[tone]}`}
          style={{ width: `${width}%`, transition: 'width 700ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </div>
      {sub && <div className="text-[11px] text-faint mt-1">{sub}</div>}
    </div>
  );
}

export function Stat({ label, value, unit, tone = 'default', icon, sub }) {
  const tones = {
    default: 'text-[color:var(--text)]',
    brand: 'text-good',
    warn: 'text-warn',
    bad: 'text-bad',
    iris: 'text-iris',
  };
  return (
    <div className="surface rounded-2xl p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-faint mb-1.5">
        {icon && <Icon name={icon} className="size-3.5" />}
        {label}
      </div>
      <div className={`text-[22px] font-semibold tabular leading-none ${tones[tone]}`}>
        {value}
        {unit && <span className="text-[12px] font-normal text-faint ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-faint mt-1.5">{sub}</div>}
    </div>
  );
}

/* ─────────────────────────────  Sheet / modal  ─────────────────────────── */

export function Sheet({ open, onClose, title, subtitle, children, size = 'md' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-2xl', lg: 'sm:max-w-4xl' };

  // Portalled to <body>: any ancestor with a transform (our page-transition
  // animation, for one) would otherwise become the containing block for
  // `position: fixed` and the overlay would no longer cover the viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-[pop_0.2s_ease-out]"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${widths[size]} max-h-[92dvh] sm:max-h-[86dvh] flex flex-col
                    rounded-t-3xl sm:rounded-3xl surface animate-rise
                    sm:mx-4`}
        style={{ background: 'var(--bg-elev)' }}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-hair shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold truncate">{title}</h3>
            {subtitle && <p className="text-[12.5px] text-dim mt-0.5">{subtitle}</p>}
          </div>
          <IconButton name="x" label="Close" onClick={onClose} />
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-4 flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────  Misc  ──────────────────────────────── */

export function Empty({ icon = 'plate', title, body, action }) {
  return (
    <div className="text-center py-10 px-6">
      <div className="mx-auto size-14 rounded-2xl grid place-items-center surface mb-3.5">
        <Icon name={icon} className="size-6 text-faint" />
      </div>
      <p className="font-medium text-[15px]">{title}</p>
      {body && <p className="text-[13px] text-dim mt-1.5 max-w-sm mx-auto leading-relaxed">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Badge({ tone = 'neutral', children, className = '' }) {
  const tones = {
    neutral: '[background:var(--border)] text-dim border-hair',
    good: 'bg-brand-500/14 text-good border-brand-400/25',
    warn: 'bg-amber-500/14 text-warn border-amber-400/25',
    bad: 'bg-rose-500/14 text-bad border-rose-400/25',
    info: 'bg-sky-500/14 text-info border-sky-400/25',
    iris: 'bg-indigo-500/14 text-iris border-indigo-400/25',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-24 sm:bottom-8 z-[60] animate-rise">
      <div className="surface rounded-2xl px-4 py-2.5 flex items-center gap-2.5 text-sm shadow-xl"
           style={{ background: 'var(--bg-elev)' }}>
        <span className="grid place-items-center size-5 rounded-full bg-brand-500/20 text-good">
          <Icon name="check" className="size-3.5" />
        </span>
        {message}
      </div>
    </div>
  );
}

/**
 * In-app reminder banner. Reminders always land here as well as in the system
 * notification, so they still reach you when notifications are blocked or you
 * are already looking at the app.
 */
export function NudgeStack({ nudges, onDismiss, onAction }) {
  if (!nudges.length) return null;

  const tones = {
    good: 'border-brand-400/30 bg-brand-500/10',
    warn: 'border-amber-400/30 bg-amber-500/10',
    info: 'border-sky-400/30 bg-sky-500/10',
  };
  const iconTone = { good: 'text-good', warn: 'text-warn', info: 'text-info' };

  return createPortal(
    <div className="fixed z-[55] left-1/2 -translate-x-1/2 top-4 w-[min(26rem,calc(100vw-2rem))] space-y-2">
      {nudges.map((n) => (
        <div
          key={n.id}
          role="status"
          className={`rounded-2xl border p-3.5 flex gap-3 animate-rise backdrop-blur-xl ${tones[n.tone] || tones.info}`}
          style={{ background: 'var(--bg-elev)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className={`size-8 rounded-xl grid place-items-center shrink-0 ${iconTone[n.tone] || iconTone.info}`}
               style={{ background: 'var(--surface)' }}>
            <Icon name={n.icon} className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium">{n.title}</div>
            <p className="text-[12px] text-dim mt-0.5 leading-relaxed">{n.body}</p>
            {onAction && n.action && (
              <button
                onClick={() => { onAction(n); onDismiss(n.id); }}
                className="text-[12px] font-medium text-good mt-2 hover:underline underline-offset-2"
              >
                {n.actionLabel}
              </button>
            )}
          </div>
          <IconButton name="x" label="Dismiss" onClick={() => onDismiss(n.id)} className="size-7 shrink-0 -mt-1 -mr-1" />
        </div>
      ))}
    </div>,
    document.body
  );
}

/** Minimal markdown → JSX for coach replies (bold, bullets, paragraphs). */
export function Markdown({ text, className = '' }) {
  const blocks = String(text).split('\n').filter((l) => l.trim() !== '');
  return (
    <div className={`space-y-2 text-[13.5px] leading-relaxed ${className}`}>
      {blocks.map((line, i) => {
        const bullet = /^[·\-*]\s+/.test(line);
        const content = bullet ? line.replace(/^[·\-*]\s+/, '') : line;
        const parts = content.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean);
        const rendered = parts.map((p, j) =>
          p.startsWith('**') ? <strong key={j} className="font-semibold text-[color:var(--text)]">{p.slice(2, -2)}</strong>
          : p.startsWith('_') ? <em key={j} className="text-faint not-italic text-[12.5px]">{p.slice(1, -1)}</em>
          : <span key={j}>{p}</span>
        );
        return bullet ? (
          <div key={i} className="flex gap-2.5 pl-1">
            <span className="text-good shrink-0 mt-px">·</span>
            <p className="text-dim">{rendered}</p>
          </div>
        ) : (
          <p key={i} className="text-dim">{rendered}</p>
        );
      })}
    </div>
  );
}

export const fmt = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 100) return Math.round(v).toLocaleString();
  if (Math.abs(v) >= 10) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(1);
  return v.toFixed(v === 0 ? 0 : 2);
};
