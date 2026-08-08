import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
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
import { AiChatPage } from './pages/AiChatPage'

function AuthenticatedApp() {
  const { loading, session, isLocalMode } = useAuth()
  if (loading) return <div className="boot-screen">Đang mở cổng học tập…</div>
  if (!isLocalMode && !session) return <LoginPage />
  return <AppProvider><Outlet /></AppProvider>
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <AuthenticatedApp />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "vocabulary", element: <VocabularyPage /> },
          { path: "learn", element: <StudyPage /> },
          { path: "review", element: <StudyPage /> },
          { path: "game", element: <GamePage /> },
          { path: "practice", element: <PracticePage /> },
          { path: "ai-chat", element: <AiChatPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "*", element: <Navigate to="/" replace /> },
        ]
      }
    ]
  }
])

export function App() {
  return <RouterProvider router={router} />
}
