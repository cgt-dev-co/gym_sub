import { useState } from 'react'

const blogPosts = [
  {
    id: 1,
    title: 'Getting Started with Your Fitness Journey',
    excerpt: 'Discover the essential steps to kickstart your fitness journey and maintain consistency in your workout routine.',
    author: 'John Smith',
    date: '2026-07-15',
    category: 'Fitness Tips',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=400&fit=crop',
    readTime: '5 min read'
  },
  {
    id: 2,
    title: 'Nutrition Tips for Better Performance',
    excerpt: 'Learn how proper nutrition can enhance your workout performance and help you achieve your fitness goals faster.',
    author: 'Sarah Johnson',
    date: '2026-07-10',
    category: 'Nutrition',
    image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=400&fit=crop',
    readTime: '7 min read'
  },
  {
    id: 3,
    title: 'The Benefits of Strength Training',
    excerpt: 'Explore how strength training can transform your body, improve bone density, and boost your overall health.',
    author: 'Mike Davis',
    date: '2026-07-05',
    category: 'Workout',
    image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&h=400&fit=crop',
    readTime: '6 min read'
  },
  {
    id: 4,
    title: 'Recovery and Rest: Why They Matter',
    excerpt: 'Understanding the importance of rest days and recovery techniques to prevent injuries and optimize results.',
    author: 'Emily Chen',
    date: '2026-06-28',
    category: 'Recovery',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=400&fit=crop',
    readTime: '4 min read'
  },
  {
    id: 5,
    title: 'Home Workouts vs Gym Training',
    excerpt: 'Compare the pros and cons of home workouts versus gym training to find the best fit for your lifestyle.',
    author: 'Tom Anderson',
    date: '2026-06-20',
    category: 'Fitness Tips',
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=400&fit=crop',
    readTime: '5 min read'
  },
  {
    id: 6,
    title: 'Mental Health and Exercise Connection',
    excerpt: 'Discover the powerful link between physical exercise and mental well-being for a healthier, happier life.',
    author: 'Lisa Brown',
    date: '2026-06-15',
    category: 'Wellness',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=400&fit=crop',
    readTime: '8 min read'
  }
]

const categories = ['All', 'Fitness Tips', 'Nutrition', 'Workout', 'Recovery', 'Wellness']

function Blog() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredPosts = blogPosts.filter(post => {
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Fitness Blog</h1>
        <p className="text-gray-600">
          Tips, guides, and insights to help you on your fitness journey
        </p>
      </div>

      <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:max-w-md">
          <input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No articles found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map(post => (
            <article
              key={post.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
            >
              <img
                src={post.image}
                alt={post.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    {post.category}
                  </span>
                  <span className="text-xs text-gray-500">{post.readTime}</span>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2 hover:text-blue-600 transition-colors">
                  {post.title}
                </h2>

                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {post.excerpt}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {post.author.charAt(0)}
                    </div>
                    <div className="ml-2">
                      <p className="text-sm font-medium text-gray-900">{post.author}</p>
                      <p className="text-xs text-gray-500">{post.date}</p>
                    </div>
                  </div>

                  <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                    Read more →
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default Blog
