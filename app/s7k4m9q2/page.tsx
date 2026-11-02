'use client'

import { FormEvent, useEffect, useState } from 'react'

export default function SecurityQuestion() {
  const [answer, setAnswer] = useState('')
  const [wrong, setWrong] = useState(false)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (!wrong) return
    const timer = window.setTimeout(() => setRevealed(true), 900)
    return () => window.clearTimeout(timer)
  }, [wrong])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (answer.trim() !== '4') {
      setWrong(true)
      setRevealed(false)
    }
  }

  return (
    <main className="announcement-shell">
      <style>{`
        .announcement-shell {
          min-height: 100svh;
          box-sizing: border-box;
          display: grid;
          place-items: center;
          padding: 24px;
          background: #000;
          color: #39ff14;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .announcement-card { width: min(100%, 460px); text-align: center; }
        .announcement-title { margin: 0 0 28px; font-size: clamp(1.35rem, 6vw, 2rem); font-weight: 400; }
        .announcement-question { margin: 0 0 24px; font-size: clamp(1rem, 4.5vw, 1.25rem); line-height: 1.5; }
        .announcement-form { display: flex; gap: 10px; justify-content: center; }
        .announcement-input, .announcement-button {
          min-height: 48px; box-sizing: border-box; border: 1px solid #39ff14;
          background: #000; color: #39ff14; font: inherit; border-radius: 0;
        }
        .announcement-input { width: 92px; padding: 10px; text-align: center; font-size: 1.1rem; }
        .announcement-button { padding: 10px 16px; cursor: pointer; }
        .announcement-button:focus-visible, .announcement-input:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
        .announcement-wrong { min-height: 30px; margin-top: 22px; font-size: 1.1rem; animation: blink 180ms steps(2, end) 2; }
        .announcement-reveal { margin: 32px 0 0; font-size: clamp(1.35rem, 6vw, 2rem); line-height: 1.35; animation: reveal 1.4s ease-out both; }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes reveal { from { opacity: 0; transform: scale(.82); letter-spacing: .35em; } to { opacity: 1; transform: scale(1); letter-spacing: .02em; } }
        @media (max-width: 380px) { .announcement-form { flex-direction: column; align-items: center; } .announcement-input, .announcement-button { width: 100%; } }
      `}</style>
      <section className="announcement-card" aria-live="polite">
        <h1 className="announcement-title">Security question</h1>
        <p className="announcement-question">For security reasons, how many people are in our family?</p>
        <form className="announcement-form" onSubmit={submit}>
          <label htmlFor="family-count" className="sr-only">Number of people in our family</label>
          <input
            id="family-count"
            className="announcement-input"
            inputMode="numeric"
            autoComplete="off"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            autoFocus
          />
          <button className="announcement-button" type="submit">Submit</button>
        </form>
        {wrong && !revealed && <p className="announcement-wrong">wrong</p>}
        {revealed && <p className="announcement-reveal">Baby MacCabe #2 arriving 2027</p>}
      </section>
    </main>
  )
}
