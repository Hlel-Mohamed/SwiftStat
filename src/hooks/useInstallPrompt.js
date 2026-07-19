import { useCallback, useEffect, useState } from 'react'

// Surfaces an in-app "Install" affordance. Chromium browsers fire
// `beforeinstallprompt`, which we capture so we can trigger the install from our own
// button. iOS Safari has no such event — there we show manual Add-to-Home-Screen steps.
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

const isIOS = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    setInstalled(isStandalone())
    setIos(isIOS())

    const onBeforeInstall = (e) => {
      e.preventDefault() // stop the mini-infobar; we show our own button
      setDeferred(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferred) return 'unavailable'
    deferred.prompt()
    let outcome = 'dismissed'
    try {
      ;({ outcome } = await deferred.userChoice)
    } catch {
      /* ignore */
    }
    setDeferred(null) // the event can only be used once
    return outcome
  }, [deferred])

  return {
    canInstall: Boolean(deferred) && !installed,
    iosHint: ios && !installed, // no programmatic install available
    installed,
    promptInstall,
  }
}
