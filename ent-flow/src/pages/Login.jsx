// =========================================================
// Login.jsx  (wireframe L0)
// Pick a role, sign in, or create a new patient profile.
//
// React idea: useState
//   const [role, setRole] = useState('doctor')
// "role" is a value React remembers between clicks.
// "setRole" changes it, and React then redraws the screen
// with the new value automatically.
// =========================================================
import { useState } from 'react'
import { Stethoscope, HeartPulse, ClipboardList, User, Lock, Plus, ArrowLeft, Check, Ear } from 'lucide-react'

// The four role cards, in the order the wireframes follow:
// doctor, receptionist, assistant (nurse), patient
const ROLES = [
  { id: 'doctor', label: 'Doctor', icon: Stethoscope, color: 'sky' },
  { id: 'receptionist', label: 'Receptionist', icon: ClipboardList, color: 'amber' },
  { id: 'nurse', label: 'Assistant', icon: HeartPulse, color: 'sky' },
  { id: 'patient', label: 'Patient', icon: User, color: 'green' },
]

// "onSignIn" comes from App.jsx. We call it with the chosen role.
// "navButtons" are the back and forward arrows.
export default function Login({ onSignIn, navButtons }) {
  const [role, setRole] = useState('doctor')
  const [showCreateProfile, setShowCreateProfile] = useState(false)

  const isPatient = role === 'patient'

  return (
    <div className="login-page">
      {/* Left blue panel with the ENT icons */}
      <div className="login-hero">
        <div className="logo"><Ear size={26} /> ENT<span>Flow</span></div>
        <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: -1, marginTop: 60 }}>
          One record for the ear, nose and throat clinic.
        </div>
        <p style={{ color: '#d6e4fb', marginTop: 14 }}>
          Queue, consultation, prescriptions and follow-up in one place. AI suggests, the doctor decides.
        </p>
        <img src="/icons/head.png" alt="" style={{ position: 'absolute', width: 170, right: -20, bottom: 150 }} />
        <img src="/icons/ear.png" alt="" style={{ position: 'absolute', width: 140, left: 20, bottom: 40 }} />
        <img src="/icons/mouth.png" alt="" style={{ position: 'absolute', width: 120, right: 40, bottom: 10 }} />
      </div>

      {/* Sign-in form */}
      <div className="card grow" style={{ padding: '40px 50px', maxWidth: 680 }}>
        <div style={{ marginBottom: 18 }}>{navButtons}</div>
        <h1>Welcome</h1>
        <p className="muted" style={{ margin: '6px 0 22px' }}>Choose your role, then sign in.</p>

        <div className="grid-4">
          {ROLES.map((r) => {
            const Icon = r.icon
            const selected = r.id === role
            return (
              <button
                key={r.id}
                className={'role-card card ' + r.color + (selected ? ' selected' : '')}
                onClick={() => {
                  setRole(r.id)
                  setShowCreateProfile(false)
                }}
              >
                <div className="row between">
                  <Icon size={20} color="#2f74d6" />
                  {selected && <Check size={16} />}
                </div>
                <b>{r.label}</b>
              </button>
            )
          })}
        </div>

        <div className="col" style={{ marginTop: 24 }}>
          {/* The first field changes with the role: patients use their phone number */}
          <div>
            <label className="label">{isPatient ? 'Phone number' : 'Staff ID'}</label>
            <input className="field" placeholder={isPatient ? '+20 10 1234 5678' : 'dr.mohammed'} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="field" type="password" placeholder="••••••••" />
          </div>

          <button className="btn full" onClick={() => onSignIn(role)}>
            Sign in as {ROLES.find((r) => r.id === role).label}
          </button>

          {/* "&&" means: only show this part when the condition is true */}
          {isPatient && (
            <div className="card amber row center">
              <User size={20} />
              <div className="grow">
                <b>New patient?</b>
                <div className="muted">Create a profile before your first visit.</div>
              </div>
              <button className="btn small" onClick={() => setShowCreateProfile(true)}>
                <Plus size={13} /> Create new profile
              </button>
            </div>
          )}

          <div className="card inner row center">
            <Lock size={16} />
            <span className="muted">Every view and change is written to the audit log.</span>
          </div>

          <button className="btn outline small" style={{ alignSelf: 'flex-start' }} onClick={() => onSignIn('owner')}>
            Clinic owner sign-in
          </button>
        </div>
      </div>

      {/* The profile form only appears after "Create new profile" is clicked */}
      {showCreateProfile && <CreateProfile onBack={() => setShowCreateProfile(false)} />}
    </div>
  )
}

// Registration form for a new patient
function CreateProfile({ onBack }) {
  const [isChild, setIsChild] = useState(false)

  return (
    <div className="card col" style={{ width: 400, padding: 28 }}>
      <button className="nav-item" onClick={onBack} style={{ width: 'auto' }}>
        <ArrowLeft size={16} /> Back to sign in
      </button>
      <h2>Create new profile</h2>
      <p className="muted">For new patients. Takes about 2 minutes.</p>

      <input className="field" placeholder="Full name" />
      <input className="field" placeholder="Date of birth (dd/mm/yyyy)" />
      <input className="field" placeholder="Phone number" />
      <input className="field" placeholder="National ID or passport number" />
      <input className="field" type="password" placeholder="Password (at least 8 characters)" />

      <label className="row center">
        <input type="checkbox" checked={isChild} onChange={(e) => setIsChild(e.target.checked)} />
        This profile is for a child
      </label>

      {/* Guardian fields only show for a child */}
      {isChild && (
        <>
          <input className="field" placeholder="Guardian full name" />
          <input className="field" placeholder="Guardian phone number" />
        </>
      )}

      <label className="row center small">
        <input type="checkbox" /> I agree to the clinic privacy notice and consent terms.
      </label>
      <button className="btn full">Create profile</button>
    </div>
  )
}
