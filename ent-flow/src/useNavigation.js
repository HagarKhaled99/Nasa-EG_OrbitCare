// =========================================================
// useNavigation.js
// Remembers where the user is (role + page) and keeps it in the
// browser history, so Back and Forward work everywhere:
// the browser buttons, the mouse side buttons, Alt + arrow keys,
// and the arrow buttons drawn in the app.
//
// React idea: a "custom hook" is a function whose name starts
// with "use" and that uses other hooks. App.jsx calls it once:
//   const nav = useNavigation()
//   nav.go('doctor', 'schedule')   opens a page (adds a history step)
//   nav.back() / nav.forward()     move through the steps
// =========================================================
import { useEffect, useRef, useState } from 'react'

const START = { role: null, page: null }   // the login page
const LAST_STEP_KEY = 'ent-flow-last-step'

// The address bar shows where you are, for example #/doctor/schedule
function addressFor({ role, page }) {
  return role ? `#/${role}/${page}` : '#/'
}

// sessionStorage can be blocked (private windows), so never let it crash the app
function readLastStep() {
  try { return Number(sessionStorage.getItem(LAST_STEP_KEY)) || 0 } catch { return 0 }
}
function saveLastStep(step) {
  try { sessionStorage.setItem(LAST_STEP_KEY, String(step)) } catch { /* not saved; forward button may stay disabled after a reload */ }
}

export default function useNavigation() {
  // After a page reload the browser still has our last position
  const saved = window.history.state
  const [place, setPlace] = useState(saved && 'step' in saved ? { role: saved.role, page: saved.page } : START)
  const step = useRef(saved && 'step' in saved ? saved.step : 0)          // where we are in the history
  const lastStep = useRef(Math.max(step.current, readLastStep()))         // the furthest step we can go forward to

  useEffect(() => {
    if (!window.history.state || !('step' in window.history.state)) {
      window.history.replaceState({ ...START, step: 0 }, '', addressFor(START))
    }

    // The browser moved back or forward: show that place
    function handlePopState(e) {
      if (!e.state || !('step' in e.state)) return
      step.current = e.state.step
      setPlace({ role: e.state.role, page: e.state.page })
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Open a new place. Anything that was "forward" from here is dropped,
  // the same way a browser drops it when you click a new link.
  function go(role, page) {
    if (role === place.role && page === place.page) return
    step.current += 1
    lastStep.current = step.current
    saveLastStep(step.current)
    window.history.pushState({ role, page, step: step.current }, '', addressFor({ role, page }))
    setPlace({ role, page })
  }

  return {
    role: place.role,
    page: place.page,
    go,
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    canBack: step.current > 0,
    canForward: step.current < lastStep.current,
  }
}
