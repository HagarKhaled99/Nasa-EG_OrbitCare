import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/orbit/app-shell'
import { OrbitProvider, useOrbit } from '@/components/orbit/orbit-provider'
import { ComingSoon } from '@/components/orbit/coming-soon'
import { ManageCrew } from '@/components/orbit/manage-crew'
import { SignIn } from '@/components/orbit/sign-in'
import { SignUp } from '@/components/orbit/sign-up'
import { TwinView } from '@/components/orbit/twin-view'

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
          <Route element={<RequireSession />}>
            <Route path="/" element={<TwinView />} />
            {/* Members 3–6: add your routes here, e.g. <Route path="/organ/:organId" element={<OrganPage />} /> */}
            <Route path="*" element={<ComingSoon />} />
          </Route>
        </Routes>
      </AppShell>
    </OrbitProvider>
  )
}
