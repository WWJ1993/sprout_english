import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { StudentProvider } from './context/StudentContext'
import AuthGate from './components/Auth/AuthGate'
import TopBar from './components/Layout/TopBar'
import Home from './pages/Home'
import Courses from './pages/Courses'
import Practice from './pages/Practice'
import Students from './pages/Students'
import Settings from './pages/Settings'
import Admin from './pages/Admin'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AuthGate>
          <StudentProvider>
            <div className="min-h-screen bg-gray-50">
              <TopBar />
              <main className="max-w-6xl mx-auto px-4 py-5">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/courses" element={<Courses />} />
                  <Route path="/practice" element={<Practice />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </StudentProvider>
        </AuthGate>
      </HashRouter>
    </AuthProvider>
  )
}
