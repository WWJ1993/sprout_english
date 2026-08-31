import { HashRouter, Routes, Route } from 'react-router-dom'
import { StudentProvider } from './context/StudentContext'
import TopBar from './components/Layout/TopBar'
import Home from './pages/Home'
import Courses from './pages/Courses'
import Practice from './pages/Practice'
import Students from './pages/Students'

export default function App() {
  return (
    <StudentProvider>
      <HashRouter>
        <div className="min-h-screen bg-gray-50">
          <TopBar />
          <main className="max-w-6xl mx-auto px-4 py-5">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/students" element={<Students />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </StudentProvider>
  )
}
