import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  author?: string;
  tags?: string[];
}

export function SEO({
  title,
  description,
  image,
  url,
  type = 'website',
  publishedTime,
  author,
  tags,
}: SEOProps) {
  const siteName = 'Realist.ca';
  const defaultTitle = 'Realist.ca - Canadian Real Estate Investment Platform';
  const defaultDescription = 'Discover investment properties across Canada. Analyze cap rates, rental yields, and market data to make smarter real estate investment decisions.';
  const defaultImage = '/og-image.jpg';

  const seoTitle = title ? `${title} | ${siteName}` : defaultTitle;
  const seoDescription = description || defaultDescription;
  const seoImage = image || defaultImage;
  const canonicalUrl = url ? `https://realist.ca${url}` : 'https://realist.ca';

  useEffect(() => {
    // Update document title
    document.title = seoTitle;

    // Update meta tags
    updateMetaTag('description', seoDescription);
    updateMetaTag('keywords', tags?.join(', ') || '');

    // Open Graph
    updateMetaTag('og:title', seoTitle, 'property');
    updateMetaTag('og:description', seoDescription, 'property');
    updateMetaTag('og:image', seoImage, 'property');
    updateMetaTag('og:url', canonicalUrl, 'property');
    updateMetaTag('og:type', type, 'property');
    updateMetaTag('og:site_name', siteName, 'property');

    // Article specific
    if (type === 'article') {
      updateMetaTag('article:published_time', publishedTime || '', 'property');
      updateMetaTag('article:author', author || siteName, 'property');
      tags?.forEach((tag) => {
        updateMetaTag('article:tag', tag, 'property');
      });
    }

    // Twitter Card
    updateMetaTag('twitter:card', 'summary_large_image', 'name');
    updateMetaTag('twitter:title', seoTitle, 'name');
    updateMetaTag('twitter:description', seoDescription, 'name');
    updateMetaTag('twitter:image', seoImage, 'name');
    updateMetaTag('twitter:domain', 'realist.ca', 'name');

    // Canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // Structured Data - Article
    if (type === 'article' && title) {
      addArticleStructuredData();
    }
  }, [seoTitle, seoDescription, seoImage, canonicalUrl, type, publishedTime, author, tags, title]);

  function updateMetaTag(
    name: string,
    value: string,
    type: 'name' | 'property' = 'name'
  ) {
    if (!value) return;
    
    let element: HTMLMetaElement | null;
    
    if (type === 'property') {
      element = document.querySelector(`meta[property="${name}"]`);
    } else {
      element = document.querySelector(`meta[name="${name}"]`);
    }
    
    if (!element) {
      element = document.createElement('meta');
      if (type === 'property') {
        element.setAttribute('property', name);
      } else {
        element.setAttribute('name', name);
      }
      document.head.appendChild(element);
    }
    element.setAttribute('content', value);
  }

  function addArticleStructuredData() {
    const scriptId = 'article-structured-data';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description: seoDescription,
      image: seoImage,
      url: canonicalUrl,
      datePublished: publishedTime,
      author: {
        '@type': 'Organization',
        name: author || siteName,
      },
      publisher: {
        '@type': 'Organization',
        name: siteName,
        logo: {
          '@type': 'ImageObject',
          url: 'https://realist.ca/logo.png',
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl,
      },
    };

    script.textContent = JSON.stringify(structuredData);
  }

  return null;
}
