// =========================================================
// main.jsx
// The starting point. It finds <div id="root"> in index.html
// and tells React to draw the <App /> component inside it.
// =========================================================
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
