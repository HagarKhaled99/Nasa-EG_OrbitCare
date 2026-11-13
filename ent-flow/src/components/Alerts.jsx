// =========================================================
// Alerts.jsx
// Red pop-up messages for alerts (follow-up red flags,
// allergies, urgent requests).
//
// React idea: Context
//   <AlertProvider> wraps the staff screens. Any page inside it
//   can call  const { raise } = useAlerts()  and then
//   raise({ id, title, text })  to pop a red message on screen,
//   without passing functions down through every component.
// =========================================================
import { createContext, useContext, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

const AlertContext = createContext(null)

// Pages use this to reach the alert functions
export function useAlerts() {
  return useContext(AlertContext)
}

// - canOpen(page): true when this role can open that page
// - onOpen(page): opens the page the alert points to
export function AlertProvider({ canOpen, onOpen, children }) {
  const [showing, setShowing] = useState([])   // pop-ups on screen now
  const [history, setHistory] = useState([])   // every alert raised since sign-in

  // Show an alert. The same id is never shown twice at once.
  function raise(alert) {
    setShowing((list) => (list.some((a) => a.id === alert.id) ? list : [...list, alert]))
    setHistory((list) => (list.some((a) => a.id === alert.id) ? list : [alert, ...list]))
  }

  function dismiss(id) {
    setShowing((list) => list.filter((a) => a.id !== id))
  }

  // The bell in the top bar shows every alert again
  function showAll() {
    setShowing(history)
  }

  return (
    <AlertContext.Provider value={{ raise, dismiss, showAll, count: history.length }}>
      {children}

      {/* Red pop-ups, stacked in the top-right corner */}
      <div className="toast-stack">
        {showing.map((alert) => (
          <div key={alert.id} className="toast" role="alert">
            <div className="toast-icon"><AlertTriangle size={20} /></div>
            <div className="grow">
              <b>{alert.title}</b>
              <div className="toast-text">{alert.text}</div>
              <div className="row mt" style={{ gap: 8 }}>
                {alert.page && canOpen(alert.page) && (
                  <button
                    className="btn small white"
                    onClick={() => {
                      onOpen(alert.page)
                      dismiss(alert.id)
                    }}
                  >
                    Open
                  </button>
                )}
                <button className="btn small ghost-white" onClick={() => dismiss(alert.id)}>Dismiss</button>
              </div>
            </div>
            <button className="toast-close" title="Close" onClick={() => dismiss(alert.id)}><X size={16} /></button>
          </div>
        ))}
      </div>
    </AlertContext.Provider>
  )
}
