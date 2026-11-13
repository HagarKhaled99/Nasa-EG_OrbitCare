// =========================================================
// ui.jsx
// Small building blocks used on many screens.
//
// React idea: a "component" is just a function that returns
// HTML-like code (called JSX). You use it like a tag:
//   <Tag color="green">Done</Tag>
// The values written on the tag (color="green") arrive in the
// function as one object called "props".
// =========================================================
import { ArrowLeft, ArrowRight } from 'lucide-react'

// A colored label. "children" is whatever is written between the
// opening and closing tag, here the word "Done".
export function Tag({ color = '', children }) {
  return <span className={'tag ' + color}>{children}</span>
}

// A white box with rounded corners. "tone" picks a background color
// (blue, sky, amber, green, red or inner). "style" lets a screen add
// one-off CSS such as a fixed width.
export function Card({ tone = '', style, children }) {
  return (
    <div className={'card ' + tone} style={style}>
      {children}
    </div>
  )
}

// A plain colored box that stands where a real picture will go later.
export function Placeholder({ width = '100%', height = 80 }) {
  return <div className="placeholder" style={{ width, height }} />
}

// A circle with the person's initials, for example "YA".
export function Avatar({ name }) {
  const initials = name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
  return <div className="avatar">{initials}</div>
}

// A row of buttons where exactly one is selected (like Day / Week).
// - options: the list of button labels
// - value: the label that is selected now
// - onChange: a function we call when the user clicks another one
export function Segmented({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((option) => (
        <button
          key={option}
          className={option === value ? 'on' : ''}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

// Picks the tag color that matches a status word, so all screens
// color "Resolved", "Active", "Red" and so on the same way.
export function statusColor(status) {
  const colors = {
    Resolved: 'green', Complete: 'green', Continue: 'soft-green', Green: 'green', Done: 'green', Normal: 'green',
    Active: 'soft-amber', Incomplete: 'soft-amber', Amber: 'amber', Soon: 'amber', Waiting: 'soft-amber',
    Red: 'red', Low: 'red', Urgent: 'red', 'Needs attention': 'red', 'Not started': 'red',
    'In visit': 'blue', 'Checked in': 'soft-blue',
  }
  return colors[status] || ''
}

// Back and forward arrows. Disabled when there is nowhere to go.
export function NavButtons({ canBack, canForward, onBack, onForward }) {
  return (
    <div className="nav-arrows">
      <button title="Back (Alt + Left)" disabled={!canBack} onClick={onBack}><ArrowLeft size={17} /></button>
      <button title="Forward (Alt + Right)" disabled={!canForward} onClick={onForward}><ArrowRight size={17} /></button>
    </div>
  )
}
