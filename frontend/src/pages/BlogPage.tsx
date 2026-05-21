import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image: string | null;
  author: string | null;
  published_at: string;
  category: string | null;
  meta_title: string | null;
  meta_description: string | null;
}

export function BlogListPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/blog?limit=20');
      const data = await response.json();
      
      if (data.success) {
        setPosts(data.data);
      } else {
        setError(data.error || 'Failed to load posts');
      }
    } catch (err) {
      setError('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <>
        <SEO
          title="Blog"
          description="Insights on Canadian real estate investing, market analysis, and wealth-building strategies."
          type="website"
        />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">Loading...</div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <SEO
          title="Blog"
          description="Insights on Canadian real estate investing, market analysis, and wealth-building strategies."
          type="website"
        />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-red-500">{error}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title="Blog"
        description="Insights on Canadian real estate investing, market analysis, and wealth-building strategies. Stay informed with the latest market updates and investment tips."
        type="website"
      />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Blog</h1>
          <p className="text-gray-600">
            Insights on Canadian real estate investing, market analysis, and wealth-building strategies.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article key={post.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              {post.featured_image && (
                <img 
                  src={post.featured_image} 
                  alt={post.title}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4">
                {post.category && (
                  <span className="text-xs font-medium text-blue-600 uppercase">
                    {post.category}
                  </span>
                )}
                <h2 className="text-xl font-bold mt-2 mb-2">
                  <Link to={`/insights/blog/${post.slug}`} className="hover:text-blue-600">
                    {post.title}
                  </Link>
                </h2>
                <p className="text-gray-600 text-sm mb-3">{post.excerpt}</p>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{post.author}</span>
                  <span>{formatDate(post.published_at)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {posts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No blog posts yet. Check back soon!
          </div>
        )}
      </div>
    </>
  );
}

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchPost(slug);
    }
  }, [slug]);

  const fetchPost = async (postSlug: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/blog/${postSlug}`);
      const data = await response.json();
      
      if (data.success) {
        setPost(data.data);
      } else {
        setError(data.error || 'Post not found');
      }
    } catch (err) {
      setError('Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <>
        <SEO
          title="Loading..."
          description="Loading blog post..."
          type="article"
        />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">Loading...</div>
        </div>
      </>
    );
  }

  if (error || !post) {
    return (
      <>
        <SEO
          title="Post Not Found"
          description="The requested blog post could not be found."
          type="article"
        />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Post not found</h1>
            <Link to="/insights/blog" className="text-blue-600 hover:underline">
              Back to blog
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title={post.meta_title || post.title}
        description={post.meta_description || post.excerpt}
        image={post.featured_image || undefined}
        url={`/insights/blog/${post.slug}`}
        type="article"
        publishedTime={post.published_at}
        author={post.author || 'Realist Team'}
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <article>
          <header className="mb-8">
            {post.category && (
              <span className="text-sm font-medium text-blue-600 uppercase">
                {post.category}
              </span>
            )}
            <h1 className="text-4xl font-bold mt-2 mb-4">{post.title}</h1>
            <div className="flex items-center gap-4 text-gray-600">
              <span>{post.author}</span>
              <span>•</span>
              <span>{formatDate(post.published_at)}</span>
            </div>
          </header>

          {post.featured_image && (
            <img 
              src={post.featured_image} 
              alt={post.title}
              className="w-full h-64 object-cover rounded-lg mb-8"
            />
          )}

          <MarkdownRenderer content={post.content} />
        </article>

        <div className="mt-12 pt-8 border-t">
          <Link to="/insights/blog" className="text-blue-600 hover:underline">
            ← Back to blog
          </Link>
        </div>
      </div>
    </>
  );
}
