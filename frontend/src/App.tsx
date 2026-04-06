import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { ListingsPage } from './pages/ListingsPage'
import { RealtorAuthPage } from './pages/RealtorAuthPage'
import { RealtorDashboard } from './pages/RealtorDashboard'
import { BlogListPage, BlogPostPage } from './pages/BlogPage'
import { GuidesListPage, GuidePage } from './pages/GuidesPage'
import { CityYieldPage } from './pages/CityYieldPage'
import { SixixplexPage } from './pages/SixixplexPage'
import { SixixplexReportPage } from './pages/SixixplexReportPage'
import { SixixplexListingsPage } from './pages/SixixplexListingsPage'
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
              <Link to="/insights/blog" className="text-sm font-medium hover:text-primary">
                Blog
              </Link>
              <Link to="/insights/guides" className="text-sm font-medium hover:text-primary">
                Guides
              </Link>
              <Link to="/insights/city-yields" className="text-sm font-medium hover:text-primary">
                City Yields
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
            
            {/* Blog Routes */}
            <Route path="/insights/blog" element={<BlogListPage />} />
            <Route path="/insights/blog/:slug" element={<BlogPostPage />} />
            
            {/* Guides Routes */}
            <Route path="/insights/guides" element={<GuidesListPage />} />
            <Route path="/insights/guides/:slug" element={<GuidePage />} />
            
            {/* City Yield Rankings */}
            <Route path="/insights/city-yields" element={<CityYieldPage />} />
            
            {/* 6ixplex */}
            <Route path="/6ixplex" element={<SixixplexPage />} />
            <Route path="/6ixplex/report" element={<SixixplexReportPage />} />
            <Route path="/6ixplex/listings" element={<SixixplexListingsPage />} />
          </Routes>
        </main>
        
        <Toaster />
      </div>
    </BrowserRouter>
  )
}

export default App
