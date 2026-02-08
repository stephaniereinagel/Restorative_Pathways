import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { initDb } from './db'
import { PeoplePage } from './pages/PeoplePage'
import { PersonPage } from './pages/PersonPage'
import { GuidePage } from './pages/GuidePage'
import { ExportTextPage } from './pages/ExportTextPage'
import { RPBrowsePage } from './pages/RPBrowsePage'
import { RPRunPage } from './pages/RPRunPage'
import { RPSessionPage } from './pages/RPSessionPage'
import { RPSummaryPage } from './pages/RPSummaryPage'
import { SessionPage } from './pages/SessionPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  useEffect(() => {
    void initDb()
  }, [])

  return (
    <Routes>
      <Route path="/" element={<PeoplePage />} />
      <Route path="/guide" element={<GuidePage />} />
      <Route path="/export" element={<ExportTextPage />} />
      <Route path="/people/:personId" element={<PersonPage />} />
      <Route path="/sessions/:sessionId" element={<SessionPage />} />
      <Route path="/sessions/:sessionId/pathways" element={<RPSessionPage />} />
      <Route path="/sessions/:sessionId/pathways/browse" element={<RPBrowsePage />} />
      <Route path="/sessions/:sessionId/pathways/run" element={<RPRunPage />} />
      <Route path="/sessions/:sessionId/pathways/summary" element={<RPSummaryPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
