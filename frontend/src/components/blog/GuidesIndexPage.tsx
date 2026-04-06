import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import GuideCard from './GuideCard';

interface Guide {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featuredImage?: string;
  author: string;
  publishedAt: string;
  category: string;
  difficulty?: string;
  estimatedReadTime?: number;
  viewCount: number;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const GuidesIndexPage: React.FC = () => {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 9,
    total: 0,
    pages: 1
  });

  const categories = [
    'All',
    'Analysis',
    'Markets',
    'Tax & Legal',
    'Financing'
  ];

  const difficulties = [
    'All',
    'Beginner',
    'Intermediate',
    'Advanced'
  ];

  useEffect(() => {
    fetchGuides();
  }, [pagination.page, selectedCategory, selectedDifficulty, searchQuery]);

  const fetchGuides = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(selectedCategory && selectedCategory !== 'All' && { category: selectedCategory }),
        ...(selectedDifficulty && selectedDifficulty !== 'All' && { difficulty: selectedDifficulty }),
        ...(searchQuery && { search: searchQuery })
      });

      const response = await fetch(`/api/guides?${params}`);
      const data = await response.json();
      
      setGuides(data.guides);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching guides:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: newPage }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getCategoryStats = () => {
    const stats: Record<string, number> = {};
    categories.forEach(cat => {
      if (cat !== 'All') {
        // This would ideally come from an API endpoint
        stats[cat] = Math.floor(Math.random() * 20) + 5; // Mock data
      }
    });
    return stats;
  };

  const categoryStats = getCategoryStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center mb-4">
            <BookOpen className="w-8 h-8 mr-3" />
            <h1 className="text-4xl md:text-5xl font-bold">Real Estate Guides</h1>
          </div>
          <p className="text-xl text-green-100 mb-8 max-w-3xl">
            Step-by-step guides to help you analyze, invest, and succeed in Canadian real estate.
          </p>
          
          <form onSubmit={handleSearch} className="max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guides..."
                className="w-full pl-12 pr-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-1/4">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center mb-4">
                <Filter className="w-5 h-5 text-gray-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Filter Guides</h3>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-3">By Category</h4>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category === 'All' ? '' : category);
                        setPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      className={`flex items-center justify-between w-full text-left px-4 py-2 rounded-md transition-colors ${
                        (category === 'All' && !selectedCategory) || selectedCategory === category
                          ? 'bg-green-100 text-green-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>{category}</span>
                      {category !== 'All' && (
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                          {categoryStats[category]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-700 mb-3">By Difficulty</h4>
                <div className="space-y-2">
                  {difficulties.map((difficulty) => (
                    <button
                      key={difficulty}
                      onClick={() => {
                        setSelectedDifficulty(difficulty === 'All' ? '' : difficulty);
                        setPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      className={`block w-full text-left px-4 py-2 rounded-md transition-colors ${
                        (difficulty === 'All' && !selectedDifficulty) || selectedDifficulty === difficulty
                          ? 'bg-green-100 text-green-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {difficulty}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">How to Use These Guides</h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <div className="bg-green-100 text-green-600 rounded-full p-1 mr-3 mt-1">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span>Start with beginner guides if you're new to real estate investing</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-green-100 text-green-600 rounded-full p-1 mr-3 mt-1">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span>Use market analysis guides to identify opportunities</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-green-100 text-green-600 rounded-full p-1 mr-3 mt-1">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span>Check tax & legal guides before making investment decisions</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Guides Grid */}
          <div className="lg:w-3/4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedCategory ? `${selectedCategory} Guides` : 'All Guides'}
                {selectedDifficulty && selectedDifficulty !== 'All' && ` (${selectedDifficulty})`}
              </h2>
              <span className="text-gray-500">
                {pagination.total} {pagination.total === 1 ? 'guide' : 'guides'} total
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
              </div>
            ) : guides.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">No guides found.</p>
                {(searchQuery || selectedCategory || selectedDifficulty) && (
                  <p className="text-gray-500 mt-2">Try adjusting your filters.</p>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {guides.map((guide) => (
                    <GuideCard key={guide.id} guide={guide} />
                  ))}
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                  <div className="flex items-center justify-center space-x-2 mt-8">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      let pageNum;
                      if (pagination.pages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.pages - 2) {
                        pageNum = pagination.pages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-4 py-2 rounded-md ${
                            pagination.page === pageNum
                              ? 'bg-green-600 text-white'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidesIndexPage;