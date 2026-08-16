import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { cycleStatus, togglePeriodStart, weightContext } from '../lib/cycle';
import { todayKey, prettyDate, shiftKey } from '../lib/calc';
import { Badge, Button, Card, Icon, NumberInput, SectionTitle, Sheet, Stat, stagger } from './ui';

/**
 * Shown only when the profile's sex is female. Cycle tracking is not relevant
 * to every user, and a permanently empty section is worse than no section.
 */
export function showCycle(profile) {
  return profile?.gender === 'female';
}

export default function Cycle() {
  const { state, dispatch } = useStore();
  const cycle = state.cycle;
  const [log, setLog] = useState(false);

  const status = useMemo(() => cycleStatus(cycle), [cycle]);
  const setCycle = (patch) => dispatch({ type: 'cycle', patch });

  if (!cycle.enabled) {
    return (
      <Card className="p-5">
        <SectionTitle icon="calendar">Cycle</SectionTitle>
        <p className="text-[13px] text-dim leading-relaxed mb-4">
          Tracking your cycle alongside your weight explains most of the noise in it. Water retention in the week
          before a period is commonly one to two kilos and disappears within days of bleeding starting — without
          that context it looks exactly like the diet failing.
        </p>
        <p className="text-[12px] text-faint leading-relaxed mb-4">
          It also changes real targets: iron needs are roughly double the male figure because of menstrual losses,
          and appetite measurably rises in the second half of the cycle.
        </p>
        <Button variant="primary" onClick={() => setCycle({ enabled: true })}>
          <Icon name="check" className="size-4" /> Turn on cycle tracking
        </Button>
        <p className="text-[11px] text-faint mt-3 leading-relaxed">
          Stored on this device only, like everything else here. It is never included in anything sent to the push
          server, and there is no account it could be attached to.
        </p>
      </Card>
    );
  }

  const note = weightContext(status);

  return (
    <div className="space-y-4">
      <Card className="p-5" glow>
        <SectionTitle
          icon="calendar"
          action={
            status?.phaseInfo && (
              <Badge tone={status.phaseInfo.tone}>{status.phaseInfo.label} phase</Badge>
            )
          }
        >
          Cycle
        </SectionTitle>

        {status?.needsFirstEntry ? (
          <div className="text-center py-4">
            <p className="text-[13px] text-dim mb-4 leading-relaxed">
              Log the first day of your last period and everything else follows from it.
            </p>
            <Button variant="primary" onClick={() => setLog(true)}>
              <Icon name="plus" className="size-4" /> Log a period start
            </Button>
          </div>
        ) : status?.stale ? (
          <div className="p-3.5 rounded-2xl border border-amber-400/25 bg-amber-500/8 flex gap-2.5">
            <Icon name="info" className="size-4 text-warn shrink-0 mt-0.5" />
            <div className="text-[12px] text-dim leading-relaxed">
              It has been {status.dayOfCycle} days since the last logged start, which is longer than any typical
              cycle — most likely a period that was not logged rather than a real gap. Add it and the predictions
              pick up again.
              <div className="mt-2">
                <Button size="sm" variant="ghost" onClick={() => setLog(true)}>Log a start date</Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              <Stat label="Cycle day" value={status.dayOfCycle} />
              <Stat
                label={status.isLate ? 'Late by' : 'Next period'}
                value={Math.abs(status.daysUntilNext)}
                unit="days"
                tone={status.isLate ? 'warn' : 'default'}
                sub={status.isLate ? 'later than average' : prettyDate(status.nextDate)}
              />
              <Stat
                label="Avg cycle"
                value={status.stats.cycleLength}
                unit="days"
                sub={status.stats.confident ? `from ${status.stats.logged} cycles` : 'default, not yet learned'}
              />
            </div>

            {status.phaseInfo && (
              <div className="mt-4 p-3.5 rounded-2xl" style={{ background: 'var(--surface)' }}>
                <div className="text-[11px] uppercase tracking-wider text-faint mb-1.5">
                  {status.phaseInfo.label} phase
                </div>
                <p className="text-[12.5px] text-dim leading-relaxed">{status.phaseInfo.note}</p>
              </div>
            )}

            {note && (
              <div className="mt-3 p-3.5 rounded-2xl border border-sky-400/25 bg-sky-500/8 flex gap-2.5">
                <Icon name="scale" className="size-4 text-info shrink-0 mt-0.5" />
                <p className="text-[12px] text-dim leading-relaxed">{note}</p>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <Button variant="primary" className="flex-1" onClick={() => setLog(true)}>
                <Icon name="plus" className="size-4" /> Period started today
              </Button>
            </div>
          </>
        )}

        {status?.stats?.variability > 7 && (
          <p className="text-[11px] text-faint mt-3 leading-relaxed">
            Your logged cycles vary by {status.stats.variability} days, so treat the prediction as a rough window
            rather than a date.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle icon="settings">Cycle settings</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[12px] font-medium text-dim mb-1.5">Typical cycle length</span>
            <NumberInput
              value={cycle.avgCycleDays} min={15} max={60} fallback={28}
              onChange={(avgCycleDays) => setCycle({ avgCycleDays })}
            />
            <span className="block text-[11px] text-faint mt-1.5">
              Used until enough cycles are logged to learn from.
            </span>
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-dim mb-1.5">Typical period length</span>
            <NumberInput
              value={cycle.avgPeriodDays} min={1} max={12} fallback={5}
              onChange={(avgPeriodDays) => setCycle({ avgPeriodDays })}
            />
          </label>
        </div>

        {cycle.periods.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-wider text-faint mb-2">
              Logged starts ({cycle.periods.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...cycle.periods].reverse().slice(0, 12).map((d, i) => (
                <button
                  key={d}
                  style={stagger(i, { step: 20, max: 180 })}
                  onClick={() => setCycle(togglePeriodStart(cycle, d))}
                  title="Remove this date"
                  className="px-2.5 py-1 rounded-full text-[11.5px] surface text-dim hover:text-bad transition-colors animate-rise"
                >
                  {prettyDate(d)} ✕
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-hair">
          <Button
            variant="danger"
            onClick={() => setCycle({ enabled: false, periods: [], notes: {} })}
          >
            <Icon name="trash" className="size-4" /> Turn off and delete cycle data
          </Button>
          <p className="text-[11px] text-faint mt-2.5 leading-relaxed">
            Removes every date logged here. Your export file will no longer contain any cycle data either.
          </p>
        </div>
      </Card>

      <p className="text-[11px] text-faint leading-relaxed px-1">
        Predictions are an average of your own logged cycles — nothing more. Cycles shift with stress, illness,
        travel and hard training. This is not contraception, not a fertility method, and not a diagnostic; if
        something changes in a way that worries you, that is a conversation for a doctor rather than an app.
      </p>

      {log && (
        <LogPeriodSheet
          cycle={cycle}
          onClose={() => setLog(false)}
          onPick={(d) => { setCycle(togglePeriodStart(cycle, d)); setLog(false); }}
        />
      )}
    </div>
  );
}

/** Picking a start date is nearly always "today" or "a day or two ago". */
function LogPeriodSheet({ cycle, onClose, onPick }) {
  const today = todayKey();
  const options = Array.from({ length: 10 }, (_, i) => shiftKey(today, -i));

  return (
    <Sheet open onClose={onClose} size="sm" title="When did it start?"
           subtitle="The first day of bleeding is day one">
      <div className="grid gap-1.5">
        {options.map((d, i) => {
          const already = cycle.periods.includes(d);
          return (
            <button
              key={d}
              onClick={() => onPick(d)}
              style={stagger(i, { step: 25, max: 200 })}
              className={`flex items-center justify-between p-3 rounded-2xl text-left animate-rise transition-all
                ${already ? 'border border-brand-400/40 bg-brand-500/10' : 'surface hover:[background:var(--surface-hover)]'}`}
            >
              <span className="text-[13.5px]">
                {i === 0 ? 'Today' : i === 1 ? 'Yesterday' : prettyDate(d)}
              </span>
              <span className="text-[11.5px] text-faint">
                {already ? 'logged — tap to remove' : i > 1 ? `${i} days ago` : ''}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
