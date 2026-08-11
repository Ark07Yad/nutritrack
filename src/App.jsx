import { useState } from 'react';
import { useStore } from './lib/store';
import { todayKey } from './lib/calc';
import { useNutrition } from './lib/useNutrition';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Diary from './components/Diary';
import Workouts from './components/Workouts';
import Nutrients from './components/Nutrients';
import Progress from './components/Progress';
import Coach from './components/Coach';
import ProfileScreen from './components/Profile';
import { Icon, NudgeStack, Toast } from './components/ui';

const NAV = [
  { id: 'home',     label: 'Home',      icon: 'home' },
  { id: 'diary',    label: 'Diary',     icon: 'plate' },
  { id: 'workouts', label: 'Train',     icon: 'dumbbell' },
  { id: 'micros',   label: 'Nutrients', icon: 'leaf' },
  { id: 'coach',    label: 'Coach',     icon: 'spark' },
];

const SIDE_EXTRA = [
  { id: 'progress', label: 'Progress', icon: 'chart' },
  { id: 'profile',  label: 'Profile',  icon: 'user' },
];

export default function App() {
  const { state, dispatch, nudges, dismissNudge } = useStore();
  const [tab, setTab] = useState('home');
  const [date, setDate] = useState(todayKey());
  const [focusSlot, setFocusSlot] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  if (!state.onboarded) return <Onboarding />;

  const navigate = (target, slot) => {
    setTab(target);
    setFocusSlot(slot ?? null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toast = (m) => setToastMsg(m);
  const allNav = [...NAV, ...SIDE_EXTRA];

  /** Reminder banners are actionable, not just informational. */
  const actOnNudge = (n) => {
    const today = todayKey();
    if (n.action === 'water') {
      const glasses = (state.days[today]?.water || 0) + 1;
      dispatch({ type: 'setDayField', date: today, field: 'water', value: glasses });
      toast(`Logged — ${(glasses * 0.25).toFixed(2)} L today`);
    } else {
      setDate(today);
      navigate('diary');
    }
  };

  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-7xl flex gap-6 px-4 sm:px-6">
        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 sticky top-0 h-dvh py-6">
          <div className="flex items-center gap-2.5 px-2 mb-8">
            <div className="size-9 rounded-xl grid place-items-center bg-gradient-to-br from-brand-300 to-brand-600 text-[#04120c] shadow-[0_6px_18px_-6px_rgb(16_185_129/0.7)]">
              <Icon name="leaf" className="size-5" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">NutriTrack</span>
          </div>

          <nav className="flex flex-col gap-1">
            {allNav.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[13.5px] font-medium transition-all
                  ${tab === item.id
                    ? 'bg-brand-500/12 text-good'
                    : 'text-dim hover:[background:var(--surface)] hover:text-[color:var(--text)]'}`}
              >
                <Icon name={item.icon} className="size-[18px]" />
                {item.label}
                {tab === item.id && <span className="ml-auto size-1.5 rounded-full bg-brand-400" />}
              </button>
            ))}
          </nav>

          <SidebarSummary date={date} />
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 min-w-0 py-5 sm:py-6 pb-28 lg:pb-8">
          {/* Mobile header */}
          <header className="lg:hidden flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl grid place-items-center bg-gradient-to-br from-brand-300 to-brand-600 text-[#04120c]">
                <Icon name="leaf" className="size-5" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight">NutriTrack</span>
            </div>
            <div className="flex gap-1">
              <HeaderTab active={tab === 'progress'} icon="chart" label="Progress" onClick={() => navigate('progress')} />
              <HeaderTab active={tab === 'profile'} icon="user" label="Profile" onClick={() => navigate('profile')} />
            </div>
          </header>

          <div key={tab} className="animate-rise">
            {tab === 'home' && <Dashboard date={date} onNavigate={navigate} />}
            {tab === 'diary' && (
              <Diary date={date} setDate={setDate} focusSlot={focusSlot} clearFocus={() => setFocusSlot(null)} toast={toast} />
            )}
            {tab === 'workouts' && <Workouts date={date} setDate={setDate} toast={toast} />}
            {tab === 'micros' && <Nutrients date={date} />}
            {tab === 'coach' && <Coach date={date} onNavigate={navigate} />}
            {tab === 'progress' && <Progress date={date} />}
            {tab === 'profile' && <ProfileScreen toast={toast} />}
          </div>
        </main>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pt-2"
           style={{ background: 'linear-gradient(to top, var(--bg) 62%, transparent)' }}>
        <div className="surface rounded-3xl flex justify-around p-1.5" style={{ background: 'var(--bg-elev)' }}>
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all active:scale-90
                ${tab === item.id ? 'text-good' : 'text-faint'}`}
            >
              <Icon name={item.icon} className="size-[19px]" />
              <span className="text-[9.5px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <NudgeStack nudges={nudges} onDismiss={dismissNudge} onAction={actOnNudge} />
      <Toast message={toastMsg} onDone={() => setToastMsg('')} />
    </div>
  );
}

function HeaderTab({ active, icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`size-9 rounded-xl grid place-items-center transition-all active:scale-90
        ${active ? 'bg-brand-500/14 text-good' : 'text-faint hover:[background:var(--surface)]'}`}
    >
      <Icon name={icon} className="size-[18px]" />
    </button>
  );
}

function SidebarSummary({ date }) {
  const n = useNutrition(date);
  const pct = Math.min(100, (n.totals.kcal / n.plan.target) * 100);

  return (
    <div className="mt-auto surface rounded-3xl p-4">
      <div className="text-[10.5px] uppercase tracking-wider text-faint">Today</div>
      <div className="text-2xl font-semibold tabular mt-1.5">
        {Math.round(n.totals.kcal)}
        <span className="text-[12px] font-normal text-faint ml-1">/ {Math.round(n.plan.target)}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mt-2.5" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full bg-gradient-to-r from-brand-300 to-brand-500"
             style={{ width: `${pct}%`, transition: 'width 700ms cubic-bezier(0.22,1,0.36,1)' }} />
      </div>
      <div className="grid grid-cols-3 gap-1.5 mt-3 text-center">
        {[['P', n.totals.protein, n.macros.protein], ['C', n.totals.carbs, n.macros.carbs], ['F', n.totals.fat, n.macros.fat]].map(([l, v, t]) => (
          <div key={l}>
            <div className="text-[9.5px] text-faint">{l}</div>
            <div className="text-[11.5px] font-medium tabular">{Math.round(v)}<span className="text-faint">/{t}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
