'use client'

import { FormEvent, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

export default function SecurityQuestion() {
  const [answer, setAnswer] = useState('')
  const [wrong, setWrong] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const sparks = Array.from({ length: 42 }, (_, index) => ({
    x: `${((index * 37) % 92) + 4}%`,
    y: `${((index * 61) % 72) + 8}%`,
    delay: `${(index % 9) * 0.18}s`,
    hue: `${(index * 47) % 360}`,
  }))

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
        .announcement-takeover { position: fixed; inset: 0; z-index: 10; overflow: hidden; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at center, #063d12 0%, #001505 38%, #000 78%); color: #39ff14; animation: takeover 700ms ease-out both; }
        .announcement-message { position: relative; z-index: 2; max-width: 920px; text-align: center; text-transform: uppercase; text-shadow: 0 0 8px #39ff14, 0 0 28px #1aff00, 0 0 60px #fff; animation: message-pop 1.2s cubic-bezier(.17,.84,.32,1.35) both; }
        .announcement-baby { display: block; font-size: clamp(2.7rem, 14vw, 9rem); line-height: .9; letter-spacing: .04em; }
        .announcement-arriving { display: block; margin-top: 22px; font-size: clamp(1.4rem, 6vw, 3.5rem); letter-spacing: .18em; }
        .announcement-spark { position: absolute; left: var(--x); top: var(--y); width: 5px; height: 5px; border-radius: 50%; background: hsl(var(--hue) 100% 65%); box-shadow: 0 0 8px 3px hsl(var(--hue) 100% 65%); animation: firework 2.2s ease-out var(--delay) infinite; }
        @keyframes takeover { from { opacity: 0; } to { opacity: 1; } }
        @keyframes message-pop { from { opacity: 0; transform: scale(.45) rotate(-4deg); letter-spacing: .35em; } 65% { transform: scale(1.08) rotate(1deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
        @keyframes firework { 0% { opacity: 0; transform: scale(.2); } 12% { opacity: 1; transform: scale(1.5); } 55% { opacity: .9; transform: scale(1) translate(0, 0); box-shadow: 0 0 10px 4px hsl(var(--hue) 100% 65%), 0 0 0 0 transparent; } 100% { opacity: 0; transform: scale(.4) translate(calc((var(--x) - 50%) * .06), 70px); } }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes reveal { from { opacity: 0; transform: scale(.82); letter-spacing: .35em; } to { opacity: 1; transform: scale(1); letter-spacing: .02em; } }
        @media (max-width: 380px) { .announcement-form { flex-direction: column; align-items: center; } .announcement-input, .announcement-button { width: 100%; } }
      `}</style>
      <section className="announcement-card" aria-live="polite">
        <h1 className="announcement-title">Security question</h1>
        <p className="announcement-question">how many people in our family</p>
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
        {revealed && (
          <div className="announcement-takeover" role="alert">
            {sparks.map((spark, index) => (
              <span
                key={index}
                className="announcement-spark"
                style={{ '--x': spark.x, '--y': spark.y, '--delay': spark.delay, '--hue': spark.hue } as CSSProperties}
              />
            ))}
            <div className="announcement-message">
              <span className="announcement-baby">Baby MacCabe #2</span>
              <span className="announcement-arriving">arriving 2027</span>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
