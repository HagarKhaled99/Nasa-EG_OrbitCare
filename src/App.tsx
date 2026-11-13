
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/orbit/app-shell'
import { OrbitProvider, useOrbit } from '@/components/orbit/orbit-provider'
import { ComingSoon } from '@/components/orbit/coming-soon'
import { ManageCrew } from '@/components/orbit/manage-crew'
import { SignIn } from '@/components/orbit/sign-in'
import { SignUp } from '@/components/orbit/sign-up'
import { TwinView } from '@/components/orbit/twin-view'
import { ActionCenter } from '@/components/orbit/action-center'
import { CrewPulse } from '@/components/orbit/crew-pulse'

function RequireSession() {
  const { session, crew, crewDbStatus } = useOrbit()
  const location = useLocation()

  if (
    session &&
    crewDbStatus === 'loading' &&
    !crew.some((c) => c.id === session.astronautId)
  ) {
    return <p className="p-8 text-center text-muted-foreground">Loading crew…</p>
  }

  if (session && !crew.some((c) => c.id === session.astronautId)) {
    return <Navigate to="/login" replace />
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

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
            <Route path="/actions" element={<ActionCenter />} />
            <Route path="/crew" element={<CrewPulse />} />
            <Route path="*" element={<ComingSoon />} />
          </Route>
        </Routes>
      </AppShell>
    </OrbitProvider>
  )
}
