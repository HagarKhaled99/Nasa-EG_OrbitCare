import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './index.css'

/**
 * Shared crew tablet: opening the app (new tab/window, or after the browser was closed) always starts at
 * "Who's checking in?". The sign-in page then ends the previous person's session (hand-over rule).
 * A refresh in the same tab keeps you signed in, because sessionStorage survives a reload but not a new tab.
 */
const OPENED_KEY = 'orbit-twin-tab-opened'
try {
  const firstOpenInThisTab = !sessionStorage.getItem(OPENED_KEY)
  sessionStorage.setItem(OPENED_KEY, '1')
  const publicPage = ['/login', '/signup', '/manage-crew'].includes(window.location.pathname)
  if (firstOpenInThisTab && !publicPage) window.history.replaceState(null, '', '/login')
} catch {
  /* storage blocked: normal routing (the server session still decides) */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
