import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ListingsPage } from './pages/ListingsPage'
import { Toaster } from './components/ui/toaster'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary">Realist.ca</h1>
            <nav className="flex gap-4">
              <a href="/" className="text-sm font-medium hover:text-primary">
                Browse Listings
              </a>
              <a href="/about" className="text-sm font-medium hover:text-primary">
                About
              </a>
            </nav>
          </div>
        </header>
        
        <main>
          <Routes>
            <Route path="/" element={<ListingsPage />} />
          </Routes>
        </main>
        
        <Toaster />
      </div>
    </BrowserRouter>
  )
}

export default App
