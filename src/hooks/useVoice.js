import { useCallback, useEffect, useRef, useState } from 'react'

// Tap-to-talk voice search using the Web Speech API.
//
// Goal: keep listening while the user talks, then stop by itself shortly after they
// finish — no manual stop needed.
//
// One session (`continuous = true`) plus our own silence timer, and deliberately NO
// restart on `onend`. An earlier version restarted to bridge mid-phrase cutoffs; on a
// phone that made the mic run forever and re-commit interim text, so "18 dex" came out
// as "18 18 18 18 tex". Now only FINAL results can persist and a session end is final.
// Human-readable messages for the terminal Web Speech error codes. `network` is the
// common one on Chromium/Firefox/Linux — those builds have no Google speech backend.
const ERROR_MESSAGES = {
  'not-allowed': 'Microphone blocked — allow mic access for this site in your browser.',
  'service-not-allowed': 'Speech recognition is disabled in this browser.',
  network: 'Voice needs Google’s speech service, which this browser can’t reach. Try Google Chrome.',
  'audio-capture': 'No microphone was found.',
  'language-not-supported': 'Voice language (en-US) isn’t supported here.',
}

export function useVoice(onResult, { silenceMs = 1200, maxMs = 15000 } = {}) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)
  const wantListeningRef = useRef(false)
  const silenceTimerRef = useRef(null)
  const maxTimerRef = useRef(null)
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

    rec.onspeechstart = armSilenceTimer

    // `continuous` keeps one session open, so `e.results` already holds everything said.
    // We separate FINAL from interim results and only ever let final text persist — that
    // makes the old duplication ("18 18 18 18 tex") structurally impossible.
    rec.onresult = (e) => {
      armSilenceTimer()
      let finalText = ''
      let interimText = ''
      // Index loop: SpeechRecognitionResultList is an indexed collection, not iterable.
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText += res[0].transcript
        else interimText += res[0].transcript
      }
      const full = `${finalText} ${interimText}`.replace(/\s+/g, ' ').trim()
      onResultRef.current?.(full)
    }

    // No restart/bridging: once the session ends, listening is over. Restarting here is
    // what previously made the mic run forever and re-commit interim text.
    rec.onend = () => {
      wantListeningRef.current = false
      clearTimers()
      setListening(false)
    }

    rec.onerror = (e) => {
      // 'no-speech'/'aborted' are transient; onend handles them without restarting.
      if (e.error === 'no-speech' || e.error === 'aborted') return
      wantListeningRef.current = false
      clearTimers()
      setListening(false)
      setError(ERROR_MESSAGES[e.error] || `Voice error: ${e.error}`)
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
    setError('')
    wantListeningRef.current = true
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

  return { supported, listening, error, start, stop, toggle }
}
