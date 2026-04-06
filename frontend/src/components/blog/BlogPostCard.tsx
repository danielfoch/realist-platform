import React from 'react';
import { CalendarDays, User, Eye, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BlogPostCardProps {
  post: {
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
  };
  featured?: boolean;
}

const BlogPostCard: React.FC<BlogPostCardProps> = ({ post, featured = false }) => {
  const formattedDate = new Date(post.publishedAt).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const tags = post.tags ? post.tags.split(',').slice(0, 3) : [];

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 ${featured ? 'border-2 border-blue-500' : ''}`}>
      {post.featuredImage && (
        <div className="h-48 overflow-hidden">
          <img 
            src={post.featuredImage} 
            alt={post.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      
      <div className="p-6">
        {post.category && (
          <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full mb-3">
            {post.category}
          </span>
        )}
        
        {featured && (
          <span className="inline-block px-3 py-1 text-xs font-semibold text-yellow-700 bg-yellow-100 rounded-full ml-2">
            Featured
          </span>
        )}
        
        <h3 className="text-xl font-bold text-gray-900 mb-3 hover:text-blue-600 transition-colors">
          <Link to={`/insights/blog/${post.slug}`}>
            {post.title}
          </Link>
        </h3>
        
        <p className="text-gray-600 mb-4 line-clamp-3">
          {post.excerpt}
        </p>
        
        <div className="flex flex-wrap items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <User className="w-4 h-4 mr-1" />
              <span>{post.author}</span>
            </div>
            
            <div className="flex items-center">
              <CalendarDays className="w-4 h-4 mr-1" />
              <span>{formattedDate}</span>
            </div>
            
            <div className="flex items-center">
              <Eye className="w-4 h-4 mr-1" />
              <span>{post.viewCount.toLocaleString()} views</span>
            </div>
          </div>
          
          <Link 
            to={`/insights/blog/${post.slug}`}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Read more →
          </Link>
        </div>
        
        {tags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center">
              <Tag className="w-4 h-4 text-gray-400 mr-2" />
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded"
                  >
                    {tag.trim()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogPostCard;