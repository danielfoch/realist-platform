import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

interface Guide {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image: string | null;
  author: string | null;
  published_at: string;
  category: string | null;
  difficulty: string | null;
  estimated_read_time_minutes: number | null;
  meta_title: string | null;
  meta_description: string | null;
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'markets', label: 'Markets' },
  { value: 'tax-legal', label: 'Tax & Legal' },
  { value: 'financing', label: 'Financing' },
];

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const CATEGORY_LABELS: Record<string, string> = {
  'analysis': 'Analysis',
  'markets': 'Markets',
  'tax-legal': 'Tax & Legal',
  'financing': 'Financing',
};

export function GuidesListPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('');

  useEffect(() => {
    fetchGuides();
  }, [category]);

  const fetchGuides = async () => {
    try {
      setLoading(true);
      const url = category 
        ? `/api/guides?category=${category}&limit=20`
        : '/api/guides?limit=20';
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setGuides(data.data);
      } else {
        setError(data.error || 'Failed to load guides');
      }
    } catch (err) {
      setError('Failed to load guides');
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
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12 text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Guides & Resources</h1>
        <p className="text-gray-600">
          Educational content to help you become a better real estate investor.
        </p>
      </div>

      {/* Category Filter */}
      <div className="mb-8">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => (
          <article key={guide.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
            {guide.featured_image && (
              <img 
                src={guide.featured_image} 
                alt={guide.title}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {guide.category && (
                  <span className="text-xs font-medium text-blue-600 uppercase">
                    {CATEGORY_LABELS[guide.category] || guide.category}
                  </span>
                )}
                {guide.difficulty && (
                  <span className="text-xs font-medium text-gray-500">
                    {DIFFICULTY_LABELS[guide.difficulty]}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold mt-2 mb-2">
                <Link to={`/insights/guides/${guide.slug}`} className="hover:text-blue-600">
                  {guide.title}
                </Link>
              </h2>
              <p className="text-gray-600 text-sm mb-3">{guide.excerpt}</p>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{guide.author}</span>
                <span>
                  {guide.estimated_read_time_minutes 
                    ? `${guide.estimated_read_time_minutes} min read`
                    : formatDate(guide.published_at)}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {guides.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No guides found. Check back soon!
        </div>
      )}
    </div>
  );
}

export function GuidePage() {
  const { slug } = useParams<{ slug: string }>();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchGuide(slug);
    }
  }, [slug]);

  const fetchGuide = async (guideSlug: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/guides/${guideSlug}`);
      const data = await response.json();
      
      if (data.success) {
        setGuide(data.data);
      } else {
        setError(data.error || 'Guide not found');
      }
    } catch (err) {
      setError('Failed to load guide');
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
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  if (error || !guide) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Guide not found</h1>
          <Link to="/insights/guides" className="text-blue-600 hover:underline">
            Back to guides
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <article>
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            {guide.category && (
              <span className="text-sm font-medium text-blue-600 uppercase">
                {CATEGORY_LABELS[guide.category] || guide.category}
              </span>
            )}
            {guide.difficulty && (
              <span className="text-sm font-medium text-gray-500">
                {DIFFICULTY_LABELS[guide.difficulty]}
              </span>
            )}
          </div>
          <h1 className="text-4xl font-bold mt-2 mb-4">{guide.title}</h1>
          <div className="flex items-center gap-4 text-gray-600">
            <span>{guide.author}</span>
            <span>•</span>
            <span>{formatDate(guide.published_at)}</span>
            {guide.estimated_read_time_minutes && (
              <>
                <span>•</span>
                <span>{guide.estimated_read_time_minutes} min read</span>
              </>
            )}
          </div>
        </header>

        {guide.featured_image && (
          <img 
            src={guide.featured_image} 
            alt={guide.title}
            className="w-full h-64 object-cover rounded-lg mb-8"
          />
        )}

        <div className="prose max-w-none">
          {/* Render markdown as simple HTML for now */}
          {guide.content.split('\n').map((line, i) => {
            if (line.startsWith('# ')) {
              return <h1 key={i} className="text-3xl font-bold mt-8 mb-4">{line.slice(2)}</h1>;
            }
            if (line.startsWith('## ')) {
              return <h2 key={i} className="text-2xl font-bold mt-6 mb-3">{line.slice(3)}</h2>;
            }
            if (line.startsWith('### ')) {
              return <h3 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(4)}</h3>;
            }
            if (line.startsWith('- ')) {
              return <li key={i} className="ml-4">{line.slice(2)}</li>;
            }
            if (line.trim() === '') {
              return <br key={i} />;
            }
            return <p key={i} className="my-2">{line}</p>;
          })}
        </div>
      </article>

      <div className="mt-12 pt-8 border-t">
        <Link to="/insights/guides" className="text-blue-600 hover:underline">
          ← Back to guides
        </Link>
      </div>
    </div>
  );
}
