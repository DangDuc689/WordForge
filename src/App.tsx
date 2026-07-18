import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AppProvider } from './context/AppContext'
import { useAuth } from './context/AuthContext'
import { DashboardPage } from './pages/DashboardPage'
import { GamePage } from './pages/GamePage'
import { LoginPage } from './pages/LoginPage'
import { PracticePage } from './pages/PracticePage'
import { SettingsPage } from './pages/SettingsPage'
import { StudyPage } from './pages/StudyPage'
import { VocabularyPage } from './pages/VocabularyPage'

function AuthenticatedApp() {
  const { loading, session, isLocalMode } = useAuth()
  if (loading) return <div className="boot-screen">Đang mở cổng học tập…</div>
  if (!isLocalMode && !session) return <LoginPage />
  return <AppProvider><AppRoutes /></AppProvider>
}

export function App() {
  return <BrowserRouter><Routes><Route path="*" element={<AuthenticatedApp />} /></Routes></BrowserRouter>
}

export function AppRoutes() {
  return <Routes>
    <Route element={<AppShell />}>
      <Route index element={<DashboardPage />} />
      <Route path="vocabulary" element={<VocabularyPage />} />
      <Route path="learn" element={<StudyPage />} />
      <Route path="review" element={<StudyPage />} />
      <Route path="game" element={<GamePage />} />
      <Route path="practice" element={<PracticePage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>
}
