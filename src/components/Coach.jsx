import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { useNutrition } from '../lib/useNutrition';
import { analyze, localAnswer, askRemote, SUGGESTED_QUESTIONS, AI_PROVIDERS } from '../lib/coach';
import { Badge, Button, Card, Chip, Icon, IconButton, Input, Markdown, SectionTitle } from './ui';
import { InsightRow } from './Dashboard';

export default function Coach({ date, onNavigate }) {
  const { state } = useStore();
  const n = useNutrition(date);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const insights = useMemo(() => analyze(n), [n]);
  const provider = AI_PROVIDERS.find((p) => p.id === state.ai.provider) || AI_PROVIDERS[0];
  const usingRemote = provider.needsKey && !!state.ai.key;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || busy) return;

    setInput('');
    setError('');
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setBusy(true);

    if (usingRemote) {
      try {
        const reply = await askRemote(question, n, state.ai, messages);
        setMessages((m) => [...m, { role: 'coach', text: reply, via: provider.name }]);
      } catch (e) {
        setError(e.message);
        setMessages((m) => [...m, { role: 'coach', text: localAnswer(question, n), via: 'Built-in coach (fallback)' }]);
      }
    } else {
      // Small delay so the reply does not appear before the question has rendered.
      await new Promise((r) => setTimeout(r, 260));
      setMessages((m) => [...m, { role: 'coach', text: localAnswer(question, n), via: 'Built-in coach' }]);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-5 pb-4">
      <Card className="p-5 sm:p-6" glow>
        <div className="flex items-start gap-4">
          <div className="size-11 rounded-2xl grid place-items-center metal shrink-0 ">
            <Icon name="spark" className="size-5.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">Your coach</h1>
              <Badge tone={usingRemote ? 'iris' : 'good'}>
                {usingRemote ? provider.name : 'Built-in · offline'}
              </Badge>
            </div>
            <p className="text-[12.5px] text-dim mt-1.5 leading-relaxed">
              Reads your actual logged data — {Math.round(n.totals.kcal)} kcal, {Math.round(n.totals.protein)} g protein
              and {n.entryCount} item{n.entryCount === 1 ? '' : 's'} so far today — and answers with your numbers, not generic advice.
            </p>
          </div>
        </div>

        {!usingRemote && (
          <button
            onClick={() => onNavigate('profile')}
            className="mt-4 w-full flex items-center gap-2.5 p-3 rounded-2xl text-left transition-all hover:[background:var(--surface-hover)]"
            style={{ background: 'var(--surface)' }}
          >
            <Icon name="bolt" className="size-4 text-iris shrink-0" />
            <span className="text-[12px] text-dim flex-1">
              Want open-ended conversation? Connect a free model — Gemini, Groq or OpenRouter all have free tiers.
            </span>
            <Icon name="chevR" className="size-4 text-faint shrink-0" />
          </button>
        )}
      </Card>

      {/* Analysis */}
      <div>
        <SectionTitle icon="chart">Today's analysis</SectionTitle>
        <div className="grid gap-2.5">
          {insights.map((ins, i) => <InsightRow key={i} insight={ins} />)}
        </div>
      </div>

      {/* Chat */}
      <Card className="flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-hair flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon name="spark" className="size-4 text-dim" />
            <span className="text-[14.5px] font-semibold">Ask anything</span>
          </div>
          {messages.length > 0 && (
            <IconButton name="trash" label="Clear conversation" onClick={() => { setMessages([]); setError(''); }} />
          )}
        </div>

        <div className="px-4 py-4 space-y-4 min-h-[220px] max-h-[520px] overflow-y-auto">
          {messages.length === 0 ? (
            <div className="py-4">
              <p className="text-[13px] text-dim text-center mb-4">
                Ask about your numbers, your diet or your training.
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <Chip key={q} onClick={() => send(q)}>{q}</Chip>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end animate-rise">
                  <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-[13.5px]
                                  metal font-medium">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3 animate-rise">
                  <div className="size-7 rounded-xl grid place-items-center bg-brand-500/14 text-good shrink-0 mt-0.5">
                    <Icon name="spark" className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Markdown text={m.text} />
                    {m.via && <div className="text-[10px] text-faint mt-2">{m.via}</div>}
                  </div>
                </div>
              )
            )
          )}

          {busy && (
            <div className="flex gap-3">
              <div className="size-7 rounded-xl grid place-items-center bg-brand-500/14 text-good shrink-0">
                <Icon name="spark" className="size-3.5" />
              </div>
              <div className="flex gap-1 items-center h-7">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 rounded-full bg-brand-400"
                    style={{ animation: `pop 0.6s ${i * 0.15}s infinite alternate ease-in-out` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <div className="mx-4 mb-3 p-3 rounded-2xl flex gap-2.5 border border-rose-400/25 bg-rose-500/8">
            <Icon name="alert" className="size-4 text-bad shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-dim leading-relaxed">
              {provider.name} failed: {error} — answered with the built-in coach instead.
            </p>
          </div>
        )}

        <div className="p-3 border-t border-hair flex gap-2">
          <Input
            placeholder="Ask about your calories, macros, micros or training…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            className="flex-1"
          />
          <Button variant="primary" onClick={() => send()} disabled={!input.trim() || busy} aria-label="Send">
            <Icon name="send" className="size-4" />
          </Button>
        </div>
      </Card>

      <p className="text-[11px] text-faint leading-relaxed px-1">
        General nutrition and training information, not medical advice. If you have a medical condition, are pregnant,
        take medication, or are dealing with disordered eating, talk to a doctor or registered dietitian before changing
        how you eat.
      </p>
    </div>
  );
}
