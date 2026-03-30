import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Trophy, Users, Crown, Target, Zap } from 'lucide-react'

interface LeaderboardEntry {
  rank: number
  user_id: number
  name: string
  deals: number
  avgCapRate: number
  avgCashOnCash: number
  badges: string[]
  topCity: string
}

interface LeaderboardStats {
  totalDealsThisPeriod: number
  avgCapRate: number
  avgCashOnCash: number
  hottestCity: string
}

interface LeaderboardData {
  period: string
  updatedAt: string
  rankings: LeaderboardEntry[]
  stats: LeaderboardStats
}

// Badge icons mapping
const badgeIcons: Record<string, string> = {
  '🌱 First Deal': '🌱',
  '📊 Analyst': '📊',
  '🏆 Pro Analyst': '🏆',
  '👑 Deal Machine': '👑',
  '🎯 Cap Rate King': '🎯',
  '💰 Cash Flow Master': '💰',
}

export const LeaderboardPage: React.FC = () => {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'alltime'>('weekly')
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLeaderboard()
  }, [period])

  const fetchLeaderboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get(`/api/leaderboard?period=${period}`)
      setData(response.data)
    } catch (err) {
      console.error('Error fetching leaderboard:', err)
      setError('Failed to load leaderboard. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />
      case 2:
        return <Trophy className="w-6 h-6 text-gray-400" />
      case 3:
        return <Trophy className="w-6 h-6 text-amber-600" />
      default:
        return <span className="text-lg font-semibold text-gray-500">#{rank}</span>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchLeaderboard}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 flex items-center justify-center gap-3">
              <Trophy className="w-10 h-10" />
              Realist.ca Leaderboard
            </h1>
            <p className="text-xl text-blue-100 mb-8">
              Top Canadian real estate investors analyzing deals
            </p>
            
            {/* Stats Cards */}
            {data?.stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <div className="text-3xl font-bold">{data.stats.totalDealsThisPeriod}</div>
                  <div className="text-blue-200 text-sm">Deals Analyzed</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <div className="text-3xl font-bold">{data.stats.avgCapRate}%</div>
                  <div className="text-blue-200 text-sm">Avg Cap Rate</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <div className="text-3xl font-bold">{data.stats.avgCashOnCash}%</div>
                  <div className="text-blue-200 text-sm">Avg CoC</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <div className="text-3xl font-bold">{data.stats.hottestCity}</div>
                  <div className="text-blue-200 text-sm">Hottest City</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="container mx-auto px-4 -mt-6">
        <div className="bg-white rounded-xl shadow-lg p-2 inline-flex">
          {(['weekly', 'monthly', 'alltime'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-4 px-6 font-semibold text-gray-600">Rank</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-600">Analyst</th>
                <th className="text-center py-4 px-6 font-semibold text-gray-600">Deals</th>
                <th className="text-center py-4 px-6 font-semibold text-gray-600">Avg Cap Rate</th>
                <th className="text-center py-4 px-6 font-semibold text-gray-600">Avg CoC</th>
                <th className="text-center py-4 px-6 font-semibold text-gray-600">Top City</th>
                <th className="text-center py-4 px-6 font-semibold text-gray-600">Badges</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.rankings.map((entry) => (
                <tr
                  key={entry.user_id}
                  className={`hover:bg-gray-50 transition-colors ${
                    entry.rank <= 3 ? 'bg-yellow-50/50' : ''
                  }`}
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-center">
                      {getRankIcon(entry.rank)}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-semibold text-gray-900">{entry.name}</div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                      <Target className="w-4 h-4" />
                      {entry.deals}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`font-semibold ${entry.avgCapRate >= 7 ? 'text-green-600' : 'text-gray-600'}`}>
                      {entry.avgCapRate}%
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`font-semibold ${entry.avgCashOnCash >= 10 ? 'text-green-600' : 'text-gray-600'}`}>
                      {entry.avgCashOnCash}%
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-gray-600">{entry.topCity || '—'}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1 justify-center">
                      {entry.badges?.map((badge) => (
                        <span
                          key={badge}
                          className="text-lg"
                          title={badge}
                        >
                          {badgeIcons[badge] || '🏅'}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {data?.rankings.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No data yet. Be the first to analyze a deal!</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <a
            href="/analyze"
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Zap className="w-6 h-6" />
            Analyze Your First Deal
          </a>
        </div>
      </div>
    </div>
  )
}
