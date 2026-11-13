import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/orbit/app-shell'
import { OrbitProvider, useOrbit } from '@/components/orbit/orbit-provider'
import { ActionCenter } from '@/components/orbit/action-center'
import { CheckInPage } from '@/components/orbit/check-in-page'
import { ComingSoon } from '@/components/orbit/coming-soon'
import { CrewPulse } from '@/components/orbit/crew-pulse'
import { FutureSlider } from '@/components/orbit/future-slider'
import { InboxPage } from '@/components/orbit/inbox'
import { GroundPortal } from '@/components/ground/ground-portal'
import { ManageCrew } from '@/components/orbit/manage-crew'
import { MissionRoutine } from '@/components/orbit/mission-routine'
import { OrganPage } from '@/components/orbit/organ-page'
import { SignIn } from '@/components/orbit/sign-in'
import { SignUp } from '@/components/orbit/sign-up'
import { TwinView } from '@/components/orbit/twin-view'
import { ValidationPage } from '@/components/orbit/validation-page'

/** Every app page sits behind this guard. No session → /login (and come back after signing in). */
function RequireSession() {
  const { session, sessionStatus, crew, crewDbStatus } = useOrbit()
  const location = useLocation()
  // Asking the server who is signed in (the session cookie is invisible to page scripts).
  if (sessionStatus === 'checking' || (session && crewDbStatus === 'loading')) {
    return (
      <p role="status" className="p-8 text-center font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
        Checking your sign-in…
      </p>
    )
  }
  // Session points at someone who is not in the crew list (e.g. just removed) → sign in again.
  if (session && !crew.some((c) => c.id === session.astronautId)) {
    return <Navigate to="/login" replace />
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function App() {
  return (
    <OrbitProvider>
      <AppShell>
        <Routes>
          <Route path="/login" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/manage-crew" element={<ManageCrew />} />
          {/* How we tested the alerts: 1,000 simulated astronauts, in memory only (public, for judges) */}
          <Route path="/validation" element={<ValidationPage />} />
          {/* Ground portal (Earth): flight surgeon + mission director, its own sign-in and layout */}
          <Route path="/ground/*" element={<GroundPortal />} />
          <Route element={<RequireSession />}>
            {/* Member 2 · Twin View */}
            <Route path="/" element={<TwinView />} />
            {/* Member 3 · Organ pages */}
            <Route path="/organ/:organId" element={<OrganPage />} />
            {/* Member 4 · Daily check-in */}
            <Route path="/check-in" element={<CheckInPage />} />
            {/* Member 5 · Action Center + Crew Pulse */}
            <Route path="/actions" element={<ActionCenter />} />
            <Route path="/crew" element={<CrewPulse />} />
            {/* Advice from the ground team + fitness for duty */}
            <Route path="/inbox" element={<InboxPage />} />
            {/* Member 6 · Future Slider + Mission & Routine */}
            <Route path="/future" element={<FutureSlider />} />
            <Route path="/mission" element={<MissionRoutine />} />
            <Route path="*" element={<ComingSoon />} />
          </Route>
        </Routes>
      </AppShell>
    </OrbitProvider>
  )
}
