import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import BlogPostCard from './BlogPostCard';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featuredImage?: string;
  author: string;
  publishedAt: string;
  category?: string;
  tags?: string;
  viewCount: number;
  isFeatured?: boolean;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const BlogIndexPage: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  });

  const categories = [
    'All',
    'Markets',
    'Analysis',
    'Tax & Legal',
    'Financing',
    'Investment Strategies'
  ];

  useEffect(() => {
    fetchBlogPosts();
    fetchFeaturedPosts();
  }, [pagination.page, selectedCategory, searchQuery]);

  const fetchBlogPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(selectedCategory && selectedCategory !== 'All' && { category: selectedCategory }),
        ...(searchQuery && { search: searchQuery })
      });

      const response = await fetch(`/api/blog?${params}`);
      const data = await response.json();
      
      setPosts(data.posts);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeaturedPosts = async () => {
    try {
      const response = await fetch('/api/blog?featured=true&limit=3');
      const data = await response.json();
      setFeaturedPosts(data.posts);
    } catch (error) {
      console.error('Error fetching featured posts:', error);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Real Estate Insights & Analysis</h1>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl">
            Expert analysis, market updates, and investment strategies from the Realist team.
          </p>
          
          <form onSubmit={handleSearch} className="max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search blog posts..."
                className="w-full pl-12 pr-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Featured Posts */}
        {featuredPosts.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {featuredPosts.map((post) => (
                <BlogPostCard key={post.id} post={post} featured />
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-1/4">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center mb-4">
                <Filter className="w-5 h-5 text-gray-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Filter by Category</h3>
              </div>
              
              <div className="space-y-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category === 'All' ? '' : category);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className={`block w-full text-left px-4 py-2 rounded-md transition-colors ${
                      (category === 'All' && !selectedCategory) || selectedCategory === category
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">About Our Blog</h3>
              <p className="text-gray-600 mb-4">
                Realist.ca provides data-driven insights and analysis for Canadian real estate investors.
              </p>
              <p className="text-gray-600">
                Our content is backed by real market data, including rental yields, cap rates, and investment analysis.
              </p>
            </div>
          </div>

          {/* Blog Posts */}
          <div className="lg:w-3/4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedCategory ? `${selectedCategory} Articles` : 'Latest Articles'}
              </h2>
              <span className="text-gray-500">
                {pagination.total} {pagination.total === 1 ? 'article' : 'articles'} total
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-600 text-lg">No blog posts found.</p>
                {searchQuery && (
                  <p className="text-gray-500 mt-2">Try a different search term.</p>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  {posts.map((post) => (
                    <BlogPostCard key={post.id} post={post} />
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
                              ? 'bg-blue-600 text-white'
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

export default BlogIndexPage;