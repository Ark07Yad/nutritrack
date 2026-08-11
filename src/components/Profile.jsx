import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { useNutrition } from '../lib/useNutrition';
import { ACTIVITY_LEVELS, GOALS, bmr, cmToFeet, feetToCm } from '../lib/calc';
import { AI_PROVIDERS } from '../lib/coach';
import {
  notificationSupport, requestNotificationPermission, registerServiceWorker,
  describeSchedule, loggingStreak,
} from '../lib/reminders';
import { storageStatus, requestPersistence, listSnapshots, restoreSnapshot } from '../lib/persist';
import {
  Badge, Button, Card, Field, Icon, Input, Segmented, Select,
  SectionTitle, Sheet, Stat,
} from './ui';

export default function Profile({ toast }) {
  const { state, dispatch } = useStore();
  const n = useNutrition();
  const p = state.profile;
  const [confirmReset, setConfirmReset] = useState(false);

  const set = (patch) => dispatch({ type: 'profile', patch });
  const imperial = p.units === 'imperial';
  const { ft, in: inch } = cmToFeet(p.height);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutritrack-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Data exported');
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.profile) throw new Error('not a NutriTrack backup');
        dispatch({ type: 'hydrate', state: { ...parsed, theme: state.theme } });
        toast('Data restored');
      } catch {
        toast('That file could not be read');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-5 pb-4">
      {/* Summary */}
      <Card className="p-5 sm:p-6" glow>
        <div className="flex items-center gap-4 mb-5">
          <div className="size-14 rounded-2xl grid place-items-center text-xl font-semibold
                          bg-gradient-to-br from-brand-300 to-brand-600 text-[#04120c] shrink-0">
            {(p.name || 'You').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight truncate">{p.name || 'Your profile'}</h1>
            <p className="text-[12.5px] text-dim mt-0.5">
              {p.age} · {p.gender === 'female' ? 'Female' : 'Male'} · {p.height} cm · {p.weight} kg
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Stat label="BMR" value={Math.round(bmr(p))} unit="kcal" sub="At complete rest" />
          <Stat label="Maintenance" value={Math.round(n.plan.maintenance)} unit="kcal" tone="iris" sub={`×${ACTIVITY_LEVELS.find((a) => a.id === p.activity)?.factor}`} />
          <Stat label="Daily target" value={Math.round(n.plan.target)} unit="kcal" tone="brand"
                sub={n.plan.delta === 0 ? 'Maintenance' : `${n.plan.delta > 0 ? '+' : ''}${Math.round(n.plan.delta)} adjustment`} />
          <Stat label="BMI" value={n.body.bmiValue.toFixed(1)}
                tone={n.body.bmiCat.tone === 'good' ? 'brand' : n.body.bmiCat.tone === 'bad' ? 'bad' : 'warn'}
                sub={n.body.bmiCat.label} />
        </div>

        {n.plan.warnings.length > 0 && (
          <div className="mt-4 space-y-2">
            {n.plan.warnings.map((w, i) => (
              <div key={i} className="p-3 rounded-2xl flex gap-2.5 border border-amber-400/25 bg-amber-500/8">
                <Icon name="alert" className="size-4 text-warn shrink-0 mt-0.5" />
                <p className="text-[11.5px] text-dim leading-relaxed">{w}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Body */}
      <Card className="p-5">
        <SectionTitle icon="user">Body</SectionTitle>
        <div className="space-y-3">
          <Field label="Name">
            <Input value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Your name" />
          </Field>

          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-dim">Units</span>
            <Segmented value={p.units} onChange={(units) => set({ units })}
                       options={[{ value: 'metric', label: 'kg · cm' }, { value: 'imperial', label: 'lb · ft' }]} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sex">
              <Select value={p.gender} onChange={(e) => set({ gender: e.target.value })}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
            </Field>
            <Field label="Age" suffix="yrs">
              <Input type="number" value={p.age} onChange={(e) => set({ age: Number(e.target.value) })} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight" suffix={imperial ? 'lb' : 'kg'}>
              <Input
                type="number" step="0.1"
                value={imperial ? Math.round(p.weight * 2.20462) : p.weight}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  set({ weight: imperial ? +(v / 2.20462).toFixed(1) : v });
                }}
              />
            </Field>
            {imperial ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Height" suffix="ft">
                  <Input type="number" value={ft} onChange={(e) => set({ height: feetToCm(Number(e.target.value), inch) })} />
                </Field>
                <Field label="&nbsp;" suffix="in">
                  <Input type="number" value={inch} onChange={(e) => set({ height: feetToCm(ft, Number(e.target.value)) })} />
                </Field>
              </div>
            ) : (
              <Field label="Height" suffix="cm">
                <Input type="number" value={p.height} onChange={(e) => set({ height: Number(e.target.value) })} />
              </Field>
            )}
          </div>

          <Field label="Body fat %" hint={`Optional. Estimated at ${n.body.bodyFat.toFixed(0)}% from your BMI, age and sex. Entering a measured value switches to the more accurate Katch-McArdle formula.`} suffix="%">
            <Input type="number" placeholder={n.body.bodyFat.toFixed(0)}
                   value={p.bodyFat ?? ''}
                   onChange={(e) => set({ bodyFat: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>

          {p.gender === 'female' && (
            <Field label="Life stage" hint="Changes folate, iron and iodine targets substantially.">
              <Select value={p.lifeStage} onChange={(e) => set({ lifeStage: e.target.value })}>
                <option value="none">Not pregnant or breastfeeding</option>
                <option value="pregnant">Pregnant</option>
                <option value="lactating">Breastfeeding</option>
              </Select>
            </Field>
          )}
        </div>
      </Card>

      {/* Goal */}
      <Card className="p-5">
        <SectionTitle icon="target">Goal</SectionTitle>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {GOALS.map((g) => (
            <button
              key={g.id}
              onClick={() => set({ goal: g.id })}
              className={`p-3.5 rounded-2xl text-left border transition-all active:scale-[0.98]
                ${p.goal === g.id ? 'bg-brand-500/12 border-brand-400/40' : 'surface hover:[background:var(--surface-hover)]'}`}
            >
              <div className="text-lg mb-1">{g.icon}</div>
              <div className="text-[13px] font-medium">{g.label}</div>
            </button>
          ))}
        </div>

        {(p.goal === 'lose' || p.goal === 'gain') && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="Target weight" suffix="kg" hint={`Healthy range ${n.body.range.min.toFixed(0)}–${n.body.range.max.toFixed(0)} kg`}>
              <Input type="number" step="0.5" value={p.targetWeight} onChange={(e) => set({ targetWeight: Number(e.target.value) })} />
            </Field>
            <Field label="Timeframe" suffix="wks" hint={n.plan.eta ? `Reaches target ${n.plan.eta.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}>
              <Input type="number" value={p.weeks} onChange={(e) => set({ weeks: Math.max(1, Number(e.target.value)) })} />
            </Field>
          </div>
        )}

        <Field label="Activity level">
          <Select value={p.activity} onChange={(e) => set({ activity: e.target.value })}>
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.id} value={a.id}>{a.label} — {a.desc}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {[['Protein', n.macros.protein, 'text-good'], ['Carbs', n.macros.carbs, 'text-info'], ['Fat', n.macros.fat, 'text-warn']].map(([l, v, c]) => (
            <div key={l} className="rounded-2xl p-3 text-center" style={{ background: 'var(--surface)' }}>
              <div className="text-[10.5px] uppercase tracking-wider text-faint">{l}</div>
              <div className={`text-lg font-semibold tabular mt-1 ${c}`}>{v}<span className="text-[11px] text-faint ml-0.5">g</span></div>
            </div>
          ))}
        </div>
      </Card>

      {/* Diet */}
      <Card className="p-5">
        <SectionTitle icon="leaf">Diet</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {[['vegan', '🌱', 'Vegan'], ['vegetarian', '🥗', 'Vegetarian'], ['nonveg', '🍗', 'Non-veg']].map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => set({ dietMode: id })}
              className={`p-3.5 rounded-2xl text-center border transition-all active:scale-[0.98]
                ${p.dietMode === id ? 'bg-brand-500/12 border-brand-400/40' : 'surface hover:[background:var(--surface-hover)]'}`}
            >
              <div className="text-xl mb-1.5">{icon}</div>
              <div className="text-[12.5px] font-medium">{label}</div>
            </button>
          ))}
        </div>
        {p.dietMode === 'vegetarian' && (
          <label className="flex items-center gap-3 mt-3 p-3 rounded-2xl cursor-pointer" style={{ background: 'var(--surface)' }}>
            <input type="checkbox" checked={p.eatsEggs} onChange={(e) => set({ eatsEggs: e.target.checked })}
                   className="size-4 accent-[var(--color-brand-500)]" />
            <span className="text-[13px]">I eat eggs</span>
          </label>
        )}
        <p className="text-[11.5px] text-faint mt-3 leading-relaxed">
          This filters every food search result, meal suggestion and coaching tip.
        </p>
      </Card>

      {/* Reminders */}
      <ReminderSettings toast={toast} />

      {/* AI */}
      <AISettings />

      {/* Storage */}
      <StorageSettings toast={toast} exportData={exportData} importData={importData} />

      {/* App */}
      <Card className="p-5">
        <SectionTitle icon="settings">App</SectionTitle>

        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[13.5px] font-medium">Theme</div>
            <div className="text-[11.5px] text-faint mt-0.5">Both are designed properly — pick whichever you prefer.</div>
          </div>
          <Segmented
            value={state.theme}
            onChange={(theme) => dispatch({ type: 'theme', theme })}
            options={[{ value: 'dark', label: '🌙' }, { value: 'light', label: '☀️' }]}
          />
        </div>

        <div className="h-px my-4" style={{ background: 'var(--border)' }} />

        <Button variant="danger" className="w-full" onClick={() => setConfirmReset(true)}>
          <Icon name="trash" className="size-4" /> Erase everything and start over
        </Button>
      </Card>

      <p className="text-[11px] text-faint text-center leading-relaxed px-4">
        NutriTrack gives general nutrition and training information. It is not medical advice, and it is not a
        substitute for a doctor or registered dietitian.
      </p>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} size="sm" title="Erase everything?"
             subtitle="This cannot be undone">
        <p className="text-[13px] text-dim leading-relaxed mb-5">
          Your profile, every logged day, your saved meals and your custom foods will all be deleted, and you will
          go back to the setup screen. Daily snapshots are kept, so this is recoverable for a week from
          Storage &amp; backup — but exporting a file first is the safer move.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setConfirmReset(false)}>Keep my data</Button>
          <Button variant="danger" className="flex-1" onClick={() => { dispatch({ type: 'reset' }); setConfirmReset(false); }}>
            Erase everything
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

/* ─────────────────────────── Reminder settings ─────────────────────────── */

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full shrink-0 mt-0.5 transition-colors duration-200
          ${checked ? 'bg-gradient-to-r from-brand-300 to-brand-500' : ''}`}
        style={checked ? undefined : { background: 'var(--border-strong)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: checked ? 'translateX(20px)' : 'none' }}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{label}</span>
        {hint && <span className="block text-[11.5px] text-faint mt-0.5 leading-relaxed">{hint}</span>}
      </span>
    </label>
  );
}

function ReminderSettings({ toast }) {
  const { state, dispatch } = useStore();
  const r = state.reminders;
  const [perm, setPerm] = useState(notificationSupport());

  const streak = loggingStreak(state.days);
  const setSection = (section, patch) => dispatch({ type: 'remindersSection', section, patch });

  const enable = async (on) => {
    if (!on) {
      dispatch({ type: 'reminders', patch: { enabled: false } });
      return;
    }
    const result = await requestNotificationPermission();
    setPerm(result);
    dispatch({ type: 'reminders', patch: { enabled: true, lastWaterAt: Date.now() } });
    registerServiceWorker();
    toast(
      result === 'granted' ? 'Reminders on'
      : result === 'denied' ? 'Reminders on — shown in-app only'
      : 'Reminders on'
    );
  };

  const testNow = async () => {
    const result = await requestNotificationPermission();
    setPerm(result);
    if (result !== 'granted') { toast('Notifications are blocked in your browser settings'); return; }
    const reg = await registerServiceWorker();
    const opts = { body: 'This is what a reminder looks like. 💧', tag: 'nutritrack-test' };
    if (reg?.showNotification) await reg.showNotification('NutriTrack', opts);
    else new Notification('NutriTrack', opts);
    toast('Sent a test notification');
  };

  return (
    <Card className="p-5">
      <SectionTitle icon="clock" action={streak > 0 && <Badge tone="good">{streak}-day streak</Badge>}>
        Reminders
      </SectionTitle>

      <Toggle
        checked={!!r.enabled}
        onChange={enable}
        label="Water and streak reminders"
        hint="Nudges you to drink through the day, and warns you in the evening if your logging streak is about to break."
      />

      {r.enabled && (
        <div className="mt-5 space-y-5 animate-rise">
          {perm === 'denied' && (
            <div className="p-3 rounded-2xl flex gap-2.5 border border-amber-400/25 bg-amber-500/8">
              <Icon name="alert" className="size-4 text-warn shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-dim leading-relaxed">
                Your browser is blocking notifications for this site, so reminders will appear as a banner inside the
                app instead. To get system notifications, re-allow them in your browser's site settings.
              </p>
            </div>
          )}

          {/* Water */}
          <div className="p-4 rounded-2xl" style={{ background: 'var(--surface)' }}>
            <Toggle
              checked={!!r.water.on}
              onChange={(on) => setSection('water', { on })}
              label="💧 Water"
              hint="Only fires while you are still short of your daily target."
            />
            {r.water.on && (
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[12px] text-dim">Remind me every</span>
                    <span className="text-[13px] font-semibold tabular">
                      {r.water.everyMinutes >= 60
                        ? `${(r.water.everyMinutes / 60).toFixed(r.water.everyMinutes % 60 ? 1 : 0)} h`
                        : `${r.water.everyMinutes} min`}
                    </span>
                  </div>
                  <input
                    type="range" min="30" max="240" step="15"
                    value={r.water.everyMinutes}
                    onChange={(e) => setSection('water', { everyMinutes: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From">
                    <Input type="time" value={r.water.from} onChange={(e) => setSection('water', { from: e.target.value })} />
                  </Field>
                  <Field label="Until">
                    <Input type="time" value={r.water.to} onChange={(e) => setSection('water', { to: e.target.value })} />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* Streak */}
          <div className="p-4 rounded-2xl" style={{ background: 'var(--surface)' }}>
            <Toggle
              checked={!!r.streak.on}
              onChange={(on) => setSection('streak', { on })}
              label="🔥 Daily streak"
              hint="An evening check if nothing is logged, and a celebration when you hit 3, 7, 14, 30, 60, 100 or 365 days."
            />
            {r.streak.on && (
              <Field label="Evening check at" className="mt-4">
                <Input type="time" value={r.streak.at} onChange={(e) => setSection('streak', { at: e.target.value })} />
              </Field>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={testNow}>
              <Icon name="send" className="size-3.5" /> Send a test
            </Button>
            <span className="text-[11.5px] text-faint">{describeSchedule(r)}</span>
          </div>

          <div className="p-3 rounded-2xl flex gap-2.5" style={{ background: 'var(--surface)' }}>
            <Icon name="info" className="size-4 text-info shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-dim leading-relaxed">
              Worth being straight about how this works: NutriTrack has no server, so there is no push
              infrastructure behind these. Reminders fire while the app is open in a tab — a backgrounded tab
              counts, and so does an installed app sitting in your app switcher. Close it completely and nothing
              fires until you open it again, at which point anything you missed appears as an in-app banner.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ──────────────────────────── Storage settings ──────────────────────────── */

const formatBytes = (b) => {
  if (!b) return '0 KB';
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

function StorageSettings({ toast, exportData, importData }) {
  const { dispatch } = useStore();
  const [status, setStatus] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    storageStatus().then(setStatus);
    listSnapshots().then(setSnapshots);
  };

  useEffect(refresh, []);

  const askPersist = async () => {
    setBusy(true);
    const { persisted } = await requestPersistence();
    setBusy(false);
    refresh();
    toast(
      persisted
        ? 'Your data is now protected from automatic clearing'
        : 'Your browser declined — keep exporting backups'
    );
  };

  const restore = async (day) => {
    const state = await restoreSnapshot(day);
    if (!state) { toast('That snapshot could not be read'); return; }
    dispatch({ type: 'hydrate', state });
    toast(`Restored the snapshot from ${day}`);
  };

  return (
    <Card className="p-5">
      <SectionTitle
        icon="save"
        action={
          status && (
            <Badge tone={status.persisted ? 'good' : 'warn'}>
              {status.persisted ? 'Protected' : 'Not protected'}
            </Badge>
          )
        }
      >
        Storage &amp; backup
      </SectionTitle>

      <p className="text-[12.5px] text-dim leading-relaxed mb-4">
        Your log is written to two places on this device — IndexedDB and local storage — and a snapshot is kept
        each day for a week. Nothing is uploaded anywhere.
      </p>

      {status && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Stat label="Stored in" value={status.backend === 'localStorage' ? 'Local storage' : 'Two places'}
                  sub={status.backend} />
            <Stat label="Space used" value={formatBytes(status.usage)}
                  sub={status.quota ? `of ${formatBytes(status.quota)} available` : 'quota unknown'} />
          </div>

          {status.persisted ? (
            <div className="p-3.5 rounded-2xl flex gap-2.5 border border-brand-400/25 bg-brand-500/8">
              <Icon name="check" className="size-4 text-good shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-dim leading-relaxed">
                <strong className="text-[color:var(--text)]">Protected from automatic clearing.</strong> Your browser
                has agreed not to evict this data when it needs space. Only you can remove it now — by clearing site
                data yourself, or with the erase button below.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl border border-amber-400/25 bg-amber-500/8">
              <div className="flex gap-2.5">
                <Icon name="alert" className="size-4 text-warn shrink-0 mt-0.5" />
                <p className="text-[11.5px] text-dim leading-relaxed">
                  <strong className="text-[color:var(--text)]">This is the setting that loses people's data.</strong>{' '}
                  Browsers clear storage for sites they consider inactive — Safari does it after about a week of not
                  visiting. Granting persistent storage stops that. Chrome usually grants it once you have used the
                  site a few times or added it to your home screen; Safari grants it on a tap like this one.
                </p>
              </div>
              <Button variant="primary" size="sm" className="w-full mt-3" onClick={askPersist} disabled={busy}>
                <Icon name="check" className="size-3.5" /> Protect my data
              </Button>
            </div>
          )}
        </>
      )}

      <div className="h-px my-4" style={{ background: 'var(--border)' }} />

      <div className="grid sm:grid-cols-2 gap-2">
        <Button variant="ghost" onClick={exportData}>
          <Icon name="save" className="size-4" /> Export to a file
        </Button>
        <label className="cursor-pointer">
          <input type="file" accept="application/json" onChange={importData} className="hidden" />
          <span className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm rounded-2xl
                           surface hover:[background:var(--surface-hover)] transition-all active:scale-[0.97]">
            <Icon name="copy" className="size-4" /> Restore from a file
          </span>
        </label>
      </div>
      <p className="text-[11.5px] text-faint mt-2.5 leading-relaxed">
        Export before you switch browsers or devices — on-device storage does not follow you between them.
      </p>

      {snapshots.length > 0 && (
        <>
          <div className="h-px my-4" style={{ background: 'var(--border)' }} />
          <div className="text-[11px] uppercase tracking-wider text-faint mb-2.5">Daily snapshots</div>
          <div className="grid gap-1.5">
            {snapshots.map((s) => (
              <div key={s.day} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--surface)' }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium tabular">{s.day}</div>
                  <div className="text-[11px] text-faint tabular mt-0.5">
                    {s.days} day{s.days === 1 ? '' : 's'} · {s.entries} logged item{s.entries === 1 ? '' : 's'}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => restore(s.day)}>Restore</Button>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] text-faint mt-2.5 leading-relaxed">
            One snapshot per day, seven kept. Useful if you delete something by accident.
          </p>
        </>
      )}
    </Card>
  );
}

/* ────────────────────────────── AI settings ────────────────────────────── */

function AISettings() {
  const { state, dispatch } = useStore();
  const { ai } = state;
  const [showKey, setShowKey] = useState(false);
  const active = AI_PROVIDERS.find((p) => p.id === ai.provider) || AI_PROVIDERS[0];

  return (
    <Card className="p-5">
      <SectionTitle icon="spark" action={<Badge tone="good">All options free</Badge>}>
        AI coach
      </SectionTitle>

      <p className="text-[12.5px] text-dim mb-4 leading-relaxed">
        The built-in coach works with no setup at all — it reads your logged data directly and needs no network.
        Connecting a hosted model adds open-ended conversation. All three below have free tiers; you bring your own key
        and it is stored only in this browser.
      </p>

      <div className="grid gap-2">
        {AI_PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => dispatch({ type: 'ai', patch: { provider: p.id, model: p.defaultModel || '' } })}
            className={`flex items-start gap-3 p-3.5 rounded-2xl text-left border transition-all active:scale-[0.99]
              ${ai.provider === p.id ? 'bg-brand-500/12 border-brand-400/40' : 'surface hover:[background:var(--surface-hover)]'}`}
          >
            <div className={`size-8 rounded-xl grid place-items-center shrink-0 mt-0.5
              ${ai.provider === p.id ? 'bg-brand-500/22 text-good' : '[background:var(--border)] text-dim'}`}>
              <Icon name={p.needsKey ? 'bolt' : 'spark'} className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13.5px] font-medium">{p.name}</span>
                {!p.needsKey && <Badge tone="good">No setup</Badge>}
              </div>
              <div className="text-[11.5px] text-faint mt-1 leading-relaxed">{p.blurb}</div>
            </div>
            {ai.provider === p.id && <Icon name="check" className="size-4 text-good shrink-0 mt-1" />}
          </button>
        ))}
      </div>

      {active.needsKey && (
        <div className="mt-4 space-y-3 animate-rise">
          <Field
            label="API key"
            hint={<>Get one free at <a href={active.keyUrl} target="_blank" rel="noreferrer noopener" className="text-good underline underline-offset-2">{active.keyUrl.replace('https://', '')}</a>. Stored only in this browser and sent only to {active.name}.</>}
          >
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder="Paste your key"
                value={ai.key}
                onChange={(e) => dispatch({ type: 'ai', patch: { key: e.target.value.trim() } })}
                className="flex-1"
              />
              <Button variant="ghost" onClick={() => setShowKey((v) => !v)}>{showKey ? 'Hide' : 'Show'}</Button>
            </div>
          </Field>

          <Field label="Model" hint="Leave as-is unless you know you want a different one.">
            <Input
              placeholder={active.defaultModel}
              value={ai.model}
              onChange={(e) => dispatch({ type: 'ai', patch: { model: e.target.value } })}
            />
          </Field>

          {ai.key && (
            <div className="p-3 rounded-2xl flex gap-2.5 border border-brand-400/25 bg-brand-500/8">
              <Icon name="check" className="size-4 text-good shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-dim leading-relaxed">
                Connected. The coach will send a summary of your profile and today's log with each question so it can
                answer with your real numbers. If a request fails, it falls back to the built-in coach automatically.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
