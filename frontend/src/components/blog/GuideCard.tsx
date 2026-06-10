import React from 'react';
import { CalendarDays, User, Clock, BookOpen, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

interface GuideCardProps {
  guide: {
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
  };
}

const GuideCard: React.FC<GuideCardProps> = ({ guide }) => {
  const formattedDate = new Date(guide.publishedAt).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'analysis':
        return <TrendingUp className="w-4 h-4" />;
      case 'markets':
        return <BookOpen className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 border-l-4 border-blue-500">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
              {getCategoryIcon(guide.category)}
            </div>
            <span className="font-semibold text-gray-700">
              {guide.category}
            </span>
          </div>
          
          {guide.difficulty && (
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getDifficultyColor(guide.difficulty)}`}>
              {guide.difficulty}
            </span>
          )}
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 mb-3 hover:text-blue-600 transition-colors">
          <Link to={`/insights/guides/${guide.slug}`}>
            {guide.title}
          </Link>
        </h3>
        
        <p className="text-gray-600 mb-4 line-clamp-3">
          {guide.excerpt}
        </p>
        
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <User className="w-4 h-4 mr-1" />
              <span>{guide.author}</span>
            </div>
            
            <div className="flex items-center">
              <CalendarDays className="w-4 h-4 mr-1" />
              <span>{formattedDate}</span>
            </div>
            
            {guide.estimatedReadTime && (
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span>{guide.estimatedReadTime} min read</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">
              {guide.viewCount.toLocaleString()} views
            </span>
            <Link 
              to={`/insights/guides/${guide.slug}`}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Read guide →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuideCard;