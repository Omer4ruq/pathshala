import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Info, SendHorizontal } from 'lucide-react'
import { Avatar, Button, PageHeader, cx } from '../components/ui'
import { useStore } from '../lib/store'
import { studentResult } from '../lib/grading'

export interface ChatMessage { role: 'user' | 'assistant'; text: string }
export interface TutorContext { studentName?: string; cls?: string; weakestSubject?: string; attendancePct?: number | null }

/**
 * The AI tutor's brain.
 * Replace this with a real API call (e.g. Supabase Edge Function → LLM), e.g.
 *   const { data } = await supabase.functions.invoke('tutor', { body: { messages, context } }); return data.reply
 * Keep the signature and the UI below doesn't change.
 */
export async function askTutor(messages: ChatMessage[], context: TutorContext): Promise<string> {
  await new Promise(r => setTimeout(r, 700 + Math.random() * 600))
  const q = messages[messages.length - 1]?.text.toLowerCase() ?? ''
  const weak = context.weakestSubject ?? 'Math'

  if (/quiz|practi[cs]e|test me/.test(q)) {
    return `Here is a 5-question quiz on ${weak}, your weakest subject right now:\n\n` +
      (({
        Math: '1. What is 3/4 + 1/8?\n2. Find 15% of 240.\n3. Solve: 2x + 7 = 19.\n4. The area of a rectangle is 48 cm² and its length is 8 cm. What is its width?\n5. Write 0.375 as a fraction in lowest terms.',
        English: '1. Give the past tense of "write".\n2. Fix the error: "She don\'t like rice."\n3. Name the part of speech of "quickly".\n4. Change to passive voice: "Rafi opened the door."\n5. Write a synonym for "brave".',
        Science: '1. What gas do plants take in for photosynthesis?\n2. What is the boiling point of water in °C?\n3. Name the force that pulls objects towards the Earth.\n4. Which organ pumps blood around the body?\n5. Is ice melting a physical or chemical change?',
      } as Record<string, string>)[weak] ?? `1–5. Open your ${weak} textbook in Books & PDFs, pick the last chapter, and answer its first five exercise questions. Send me your answers and I will check them.`) +
      '\n\nReply with your answers and I will mark them.'
  }
  if (/attendance|absent|late/.test(q)) {
    const p = context.attendancePct
    return `${p != null ? `Your attendance is ${p.toFixed(0)}%. ` : ''}Attendance counts towards every subject's result, so each day you come in helps your average.\n\n• Aim for every school day; a late counts as half a day, so arriving on time matters too.\n• If you are ill, ask your guardian to inform the class teacher.\n• Missed a class? Ask a friend for notes the same day and check the textbook chapter in Books & PDFs.`
  }
  if (/fraction|math|algebra|equation|percent/.test(q)) {
    return 'Fractions are parts of a whole. Imagine a roti cut into 4 equal pieces. If you eat 1 piece, you ate 1/4.\n\nAdding fractions: make the bottom numbers (denominators) the same first.\n  1/4 + 1/2 → 1/4 + 2/4 = 3/4\n\nTry this: 2/3 + 1/6 = ?\n(Hint: change 2/3 into sixths.)'
  }
  if (/english|grammar|tense|verb|sentence/.test(q)) {
    return 'Quick grammar tip, subject–verb agreement:\n• He/She/It → verb + s: "She plays", "He doesn\'t"\n• I/You/We/They → base verb: "They play", "We don\'t"\n\nFix these: "My brother go to school." · "They was late."'
  }
  if (/science|plant|photosynth|energy|cell/.test(q)) {
    return 'Photosynthesis in one line: plants use sunlight to turn water and carbon dioxide into food (glucose), giving out oxygen.\n\nWater + Carbon dioxide → (sunlight) → Glucose + Oxygen\n\nWant a 5-question quiz on this?'
  }
  return `Good question! I can explain topics step by step, make practice quizzes, or help you plan revision.\n\nBased on your results, ${weak} needs the most practice. Try asking "Make me a quiz on ${weak}" or "Explain fractions with an example".`
}

const SUGGESTIONS = ['Explain fractions with an example', 'Make me a 5-question quiz on my weakest subject', 'How can I improve my attendance score?']

export default function Tutor() {
  const { db, user, weights } = useStore()
  const context = useMemo<TutorContext>(() => {
    const s = db.students.find(x => x.id === user!.refId)
    if (!s) return {}
    const r = studentResult(db, s, {}, weights)
    const weakest = r.subjects.filter(x => x.total != null).sort((a, b) => a.total! - b.total!)[0]
    return { studentName: s.name, cls: s.cls, weakestSubject: weakest?.subject, attendancePct: r.attendance }
  }, [db, user, weights])

  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', text: `Hi${context.studentName ? ` ${context.studentName.split(' ')[0]}` : ''}! I'm your study helper. Ask me about any subject, or tap a suggestion below.` }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages, busy])

  const send = async (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    const next = [...messages, { role: 'user' as const, text: t }]
    setMessages(next); setInput(''); setBusy(true)
    try {
      const reply = await askTutor(next, context)
      setMessages(m => [...m, { role: 'assistant', text: reply }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'Sorry, I could not answer that just now. Please try again.' }])
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="AI tutor" subtitle={context.weakestSubject ? `Tip: ${context.weakestSubject} is where practice will help you most.` : 'Ask questions, get explanations and practice quizzes.'} />
      <div className="flex h-[calc(100vh-15rem)] min-h-110 flex-col overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex items-center gap-2 border-b border-line bg-sky-soft px-4 py-2.5 text-[13px] text-ink">
          <Info size={15} className="shrink-0 text-sky" /> Demo replies — the real AI tutor will be connected later.
        </div>

        <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={cx('flex items-end gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
              {m.role === 'assistant'
                ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-marigold"><Bot size={17} /></span>
                : <Avatar name={user!.name} size={32} />}
              <div className={cx('max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed',
                m.role === 'user' ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md bg-paper')}>{m.text}</div>
            </div>
          ))}
          {busy && (
            <div className="flex items-end gap-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-ink text-marigold"><Bot size={17} /></span>
              <div className="flex gap-1 rounded-2xl rounded-bl-md bg-paper px-4 py-3.5" aria-label="Tutor is typing">
                {[0, 150, 300].map(d => <span key={d} className="size-2 animate-bounce rounded-full bg-ink-soft/60" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          )}
          <div ref={end} />
        </div>

        <div className="border-t border-line p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button key={s} disabled={busy} onClick={() => send(s)}
                className="rounded-full border border-line px-3 py-1.5 text-[13px] font-medium text-ink-soft transition hover:border-marigold hover:bg-marigold-soft hover:text-ink disabled:opacity-50">{s}</button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); send(input) }}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask a question…" aria-label="Your question"
              className="h-11 flex-1 rounded-xl border border-line bg-white px-4 text-sm focus:border-ink focus:outline-none" />
            <Button type="submit" icon={SendHorizontal} disabled={busy || !input.trim()} className="h-11">Send</Button>
          </form>
        </div>
      </div>
    </div>
  )
}
