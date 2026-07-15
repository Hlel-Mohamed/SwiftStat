import { useCallback, useEffect, useRef, useState } from 'react'

// Tap-to-talk voice search using the Web Speech API.
//
// Goal: keep listening while the user talks, then stop by itself after a
// comfortable pause (default 1.5s of silence) — no manual stop needed.
//
// The API gives no knob for the silence threshold, and its own end-of-speech is
// too twitchy. So we run continuous mode plus our OWN silence timer. The catch:
// Chrome fires `no-speech` → `onend` on silence, so blindly restarting on `onend`
// creates a start/stop tight loop (the mic flickering on and off). We therefore
// restart ONLY when speech was detected very recently (a real mid-sentence cutoff),
// throttle restarts so they can't loop, and otherwise stop cleanly.
export function useVoice(onResult, { silenceMs = 1500, maxMs = 25000 } = {}) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const wantListeningRef = useRef(false)
  const silenceTimerRef = useRef(null)
  const maxTimerRef = useRef(null)
  const lastSpeechAtRef = useRef(0)
  const lastRestartAtRef = useRef(0)
  // Transcript accumulation across Chrome's mid-phrase session cutoffs: `committed`
  // holds text finalized before each bridged restart; `session` is the current
  // session's text. Reporting committed+session keeps early words (fixes "fire…ball").
  const committedRef = useRef('')
  const sessionTextRef = useRef('')
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const clearTimers = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current)
    silenceTimerRef.current = null
    maxTimerRef.current = null
  }

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    setSupported(true)
    const rec = new SR()
    rec.lang = 'en-US'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    const stopIntentionally = () => {
      wantListeningRef.current = false
      clearTimers()
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    }

    const armSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(stopIntentionally, silenceMs)
    }

    const report = () => {
      const full = `${committedRef.current} ${sessionTextRef.current}`.replace(/\s+/g, ' ').trim()
      onResultRef.current?.(full)
    }

    const noteSpeech = () => {
      lastSpeechAtRef.current = Date.now()
      armSilenceTimer()
    }

    rec.onspeechstart = noteSpeech

    rec.onresult = (e) => {
      noteSpeech()
      let transcript = ''
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript
      sessionTextRef.current = transcript
      report()
    }

    rec.onend = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
      const now = Date.now()
      const spokeRecently = lastSpeechAtRef.current && now - lastSpeechAtRef.current < silenceMs
      const notLooping = now - lastRestartAtRef.current > 500
      // Bridge a genuine mid-sentence cutoff — commit this session's text first so it
      // isn't lost when the new (empty) session begins.
      if (wantListeningRef.current && spokeRecently && notLooping) {
        lastRestartAtRef.current = now
        if (sessionTextRef.current) committedRef.current = `${committedRef.current} ${sessionTextRef.current}`.trim()
        sessionTextRef.current = ''
        try {
          rec.start()
          return
        } catch {
          /* fall through to stop */
        }
      }
      wantListeningRef.current = false
      clearTimers()
      setListening(false)
    }

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantListeningRef.current = false
        clearTimers()
        setListening(false)
      }
      // 'no-speech'/'aborted' are transient; onend handles them without restarting.
    }

    recognitionRef.current = rec
    return () => {
      wantListeningRef.current = false
      clearTimers()
      recognitionRef.current = null
      try {
        rec.abort()
      } catch {
        /* ignore */
      }
    }
  }, [silenceMs])

  const start = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec || wantListeningRef.current) return
    wantListeningRef.current = true
    lastSpeechAtRef.current = 0
    lastRestartAtRef.current = Date.now()
    committedRef.current = ''
    sessionTextRef.current = ''
    setListening(true)
    try {
      rec.start()
      clearTimers()
      // Initial grace: a few seconds to start talking before the first silence timeout.
      silenceTimerRef.current = setTimeout(() => {
        wantListeningRef.current = false
        try {
          rec.stop()
        } catch {
          /* ignore */
        }
      }, Math.max(silenceMs, 4000))
      // Hard watchdog: never keep the mic open past maxMs, even under sustained noise.
      maxTimerRef.current = setTimeout(() => {
        wantListeningRef.current = false
        try {
          rec.stop()
        } catch {
          /* ignore */
        }
      }, maxMs)
    } catch {
      /* already started */
    }
  }, [silenceMs, maxMs])

  const stop = useCallback(() => {
    wantListeningRef.current = false
    clearTimers()
    setListening(false)
    recognitionRef.current?.stop()
  }, [])

  const toggle = useCallback(() => {
    if (wantListeningRef.current) stop()
    else start()
  }, [start, stop])

  return { supported, listening, start, stop, toggle }
}
