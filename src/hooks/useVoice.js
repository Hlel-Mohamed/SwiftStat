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
export function useVoice(onResult, { silenceMs = 1500 } = {}) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const wantListeningRef = useRef(false)
  const silenceTimerRef = useRef(null)
  const lastSpeechAtRef = useRef(0)
  const lastRestartAtRef = useRef(0)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
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
      clearSilenceTimer()
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    }

    // (Re)start the quiet countdown. After `silenceMs` with no speech, stop for good.
    const armSilenceTimer = () => {
      clearSilenceTimer()
      silenceTimerRef.current = setTimeout(stopIntentionally, silenceMs)
    }

    const noteSpeech = () => {
      lastSpeechAtRef.current = Date.now()
      armSilenceTimer()
    }

    rec.onspeechstart = noteSpeech

    rec.onresult = (e) => {
      noteSpeech()
      let transcript = ''
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
      }
      onResultRef.current?.(transcript.trim())
    }

    rec.onend = () => {
      clearSilenceTimer()
      const now = Date.now()
      const spokeRecently = lastSpeechAtRef.current && now - lastSpeechAtRef.current < silenceMs
      const notLooping = now - lastRestartAtRef.current > 500
      // Only bridge a genuine mid-sentence cutoff — never restart on pure silence,
      // which is what caused the on/off flicker.
      if (wantListeningRef.current && spokeRecently && notLooping) {
        lastRestartAtRef.current = now
        try {
          rec.start()
          return
        } catch {
          /* fall through to stop */
        }
      }
      wantListeningRef.current = false
      setListening(false)
    }

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantListeningRef.current = false
        clearSilenceTimer()
        setListening(false)
      }
      // 'no-speech'/'aborted' are transient; onend handles them without restarting.
    }

    recognitionRef.current = rec
    return () => {
      wantListeningRef.current = false
      clearSilenceTimer()
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
    setListening(true)
    try {
      rec.start()
      // Initial grace: give a few seconds to start talking before the first
      // silence timeout can fire.
      clearSilenceTimer()
      silenceTimerRef.current = setTimeout(() => {
        wantListeningRef.current = false
        try {
          rec.stop()
        } catch {
          /* ignore */
        }
      }, Math.max(silenceMs, 4000))
    } catch {
      /* already started */
    }
  }, [silenceMs])

  const stop = useCallback(() => {
    wantListeningRef.current = false
    clearSilenceTimer()
    setListening(false)
    recognitionRef.current?.stop()
  }, [])

  const toggle = useCallback(() => {
    if (wantListeningRef.current) stop()
    else start()
  }, [start, stop])

  return { supported, listening, start, stop, toggle }
}
