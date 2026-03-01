import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { ListingsPage } from './pages/ListingsPage'
import { RealtorAuthPage } from './pages/RealtorAuthPage'
import { RealtorDashboard } from './pages/RealtorDashboard'
import { Toaster } from './components/ui/toaster'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary">
              <Link to="/">Realist.ca</Link>
            </h1>
            <nav className="flex gap-4">
              <Link to="/" className="text-sm font-medium hover:text-primary">
                Browse Listings
              </Link>
              <Link to="/realtor" className="text-sm font-medium hover:text-primary">
                Realtor Portal
              </Link>
            </nav>
          </div>
        </header>
        
        <main>
          <Routes>
            <Route path="/" element={<ListingsPage />} />
            <Route path="/realtor" element={<RealtorAuthPage />} />
            <Route path="/realtor/login" element={<RealtorAuthPage />} />
            <Route path="/realtor/dashboard" element={<RealtorDashboard />} />
          </Routes>
        </main>
        
        <Toaster />
      </div>
    </BrowserRouter>
  )
}

export default App
