import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { firebase_auth } from '../utils/firebaseConfig';
import { getUserStats, getNextChallenge, getXPProgress, initializeUserProfile } from '../utils/gameUtils';
import { fetchRecommendedGames } from '../utils/rawgService';
import { getCurrentRegion } from '../utils/locationService';

const TOURNAMENTS = {
  us: [
    { id: 'na-valorant', name: 'Valorant Champions Tour - NA Qualifier', game: 'Valorant', date: 'Monthly', format: 'Online / LAN - Los Angeles' },
    { id: 'na-rl', name: 'RLCS North America Regional', game: 'Rocket League', date: 'Quarterly', format: 'Online' },
    { id: 'na-fn', name: 'Fortnite Cash Cup - East', game: 'Fortnite', date: 'Weekly', format: 'Online' },
  ],
  ca: [
    { id: 'ca-sf6', name: 'Toronto Throwdown', game: 'Street Fighter 6', date: 'Next: Dec 12', format: 'LAN - Toronto' },
    { id: 'ca-lol', name: 'League Amateur Open', game: 'League of Legends', date: 'Monthly', format: 'Online / Montreal' },
  ],
  eu: [
    { id: 'eu-vct', name: 'Valorant Challengers Europe', game: 'Valorant', date: 'Weekly', format: 'Online / Berlin' },
    { id: 'eu-fifa', name: 'EA FC Champions Cup', game: 'EA FC 25', date: 'Quarterly', format: 'LAN - London' },
    { id: 'eu-cs', name: 'CS2 ESL Challenger', game: 'Counter-Strike 2', date: 'Bi-Monthly', format: 'LAN - Katowice' },
  ],
  asia: [
    { id: 'asia-lol', name: 'LoL Pacific Tier 2', game: 'League of Legends', date: 'Weekly', format: 'Online / Seoul' },
    { id: 'asia-ml', name: 'MLBB Southeast Series', game: 'Mobile Legends', date: 'Monthly', format: 'Online / Jakarta' },
    { id: 'asia-tekken', name: 'Tekken World Tour Stop', game: 'Tekken 8', date: 'Next: Jan 18', format: 'LAN - Tokyo' },
  ],
  default: [
    { id: 'global-valorant', name: 'Valorant Champions Tour Open Qualifiers', game: 'Valorant', date: 'Seasonal', format: 'Online' },
    { id: 'global-overwatch', name: 'Overwatch Champions Series', game: 'Overwatch 2', date: 'Seasonal', format: 'Online / LAN Finals' },
    { id: 'global-smash', name: 'Global Smash Circuit', game: 'Super Smash Bros. Ultimate', date: 'Ongoing', format: 'LAN - rotating cities' },
  ],
};

// Get tournament list based on user's region/country
// Returns region-specific tournaments or default global tournaments
function getTournamentList(regionInfo) {
  const countryCode = (regionInfo.country || '').toLowerCase();

  // Check for United States
  if (countryCode.includes('united states') || countryCode.includes('usa')) {
    return TOURNAMENTS.us;
  }

  // Check for Canada
  if (countryCode.includes('canada')) {
    return TOURNAMENTS.ca;
  }

  // Check for European countries
  if (
    ['united kingdom', 'uk', 'france', 'germany', 'spain', 'italy', 'netherlands', 'sweden'].some((country) =>
      countryCode.includes(country)
    )
  ) {
    return TOURNAMENTS.eu;
  }

  // Check for Asian countries
  if (
    ['japan', 'south korea', 'korea', 'china', 'singapore', 'indonesia', 'philippines', 'thailand', 'malaysia'].some(
      (country) => countryCode.includes(country)
    )
  ) {
    return TOURNAMENTS.asia;
  }

  // Default to global tournaments if region not found
  return TOURNAMENTS.default;
}

export default function StatsScreen({ navigation }) {
  // User statistics (level, XP, challenges completed, etc.)
  const [stats, setStats] = useState(null);
  // Next recommended challenge for user
  const [nextChallenge, setNextChallenge] = useState(null);
  // Loading state for initial data load
  const [loading, setLoading] = useState(true);
  // Loading state for pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  // Game recommendations from RAWG API
  const [recommendations, setRecommendations] = useState([]);
  // Loading state for game recommendations
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  // User's location information (city, region, country)
  const [regionInfo, setRegionInfo] = useState(null);
  // Loading state for location data
  const [regionLoading, setRegionLoading] = useState(true);
  // Error message if location fails
  const [regionError, setRegionError] = useState('');

  // Load all data when screen mounts
  useEffect(() => {
    loadStats();
    loadRecommendations();
    loadRegion();
  }, []);

  // Load user statistics and next challenge from Firebase
  const loadStats = async () => {
    try {
      const user = firebase_auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      // Initialize profile if needed (creates user document if first time)
      await initializeUserProfile(user.uid, user.email);

      // Load stats and challenge recommendation in parallel for better performance
      const [userStats, challenge] = await Promise.all([
        getUserStats(user.uid),
        getNextChallenge(user.uid),
      ]);

      setStats(userStats);
      setNextChallenge(challenge);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load game recommendations from RAWG API
  const loadRecommendations = async () => {
    setRecommendationsLoading(true);
    try {
      const games = await fetchRecommendedGames();
      setRecommendations(games);
    } catch (error) {
      console.error('Error loading RAWG recommendations:', error);
      setRecommendations([]); // Set empty array on error
    } finally {
      setRecommendationsLoading(false);
    }
  };

  // Load user's location to show regional tournaments
  const loadRegion = async () => {
    setRegionLoading(true);
    setRegionError('');
    try {
      // Get current location and convert to city/region/country
      const info = await getCurrentRegion();
      setRegionInfo(info);
    } catch (error) {
      // Handle location permission denied or other errors
      setRegionError(error.message || 'Location unavailable');
      setRegionInfo(null);
    } finally {
      setRegionLoading(false);
    }
  };

  // Handle pull-to-refresh - reload all data
  const onRefresh = async () => {
    setRefreshing(true);
    // Reload all data in parallel
    await Promise.all([loadStats(), loadRecommendations(), loadRegion()]);
    setRefreshing(false);
  };

  // Show loading spinner while initial data is loading
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Show message if no stats available
  if (!stats) {
    return (
      <View style={styles.container}>
        <Card elevation={0}>
          <Card.Content>
            <Paragraph>No stats available. Complete a challenge to get started!</Paragraph>
          </Card.Content>
        </Card>
      </View>
    );
  }

  // Calculate XP progress for progress bar
  const xpProgress = getXPProgress(stats.totalXP || 0, stats.level || 1);
  const xpForNextLevel = (stats.level || 1) * 1000;
  const xpNeeded = xpForNextLevel - (stats.totalXP || 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        {/* Level & XP Card */}
        <Card style={styles.mainCard} elevation={0}>
          <Card.Content>
            <View style={styles.levelHeader}>
              <Icon name="trophy" size={48} color="#FFD700" />
              <View style={styles.levelInfo}>
                <Title style={styles.levelText}>Level {stats.level || 1}</Title>
                <Paragraph style={styles.xpText}>
                  {stats.totalXP || 0} Total XP
                </Paragraph>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Paragraph style={styles.progressLabel}>
                  Progress to Level {stats.level + 1}
                </Paragraph>
                <Paragraph style={styles.progressValue}>
                  {xpProgress.current} / {xpProgress.needed} XP
                </Paragraph>
              </View>
              <ProgressBar
                progress={xpProgress.progress / 100}
                color="#4CAF50"
                style={styles.progressBar}
              />
              <Paragraph style={styles.xpNeeded}>
                {xpNeeded} XP needed for next level
              </Paragraph>
            </View>
          </Card.Content>
        </Card>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard} elevation={0}>
            <Card.Content style={styles.statContent}>
              <Icon name="target" size={32} color="#FF5722" />
              <Title style={styles.statValue}>{stats.bestScore || 0}</Title>
              <Paragraph style={styles.statLabel}>Best Score</Paragraph>
            </Card.Content>
          </Card>

          <Card style={styles.statCard} elevation={0}>
            <Card.Content style={styles.statContent}>
              <Icon name="check-circle" size={32} color="#4CAF50" />
              <Title style={styles.statValue}>{stats.challengesCompleted || 0}</Title>
              <Paragraph style={styles.statLabel}>Challenges Completed</Paragraph>
            </Card.Content>
          </Card>

          <Card style={styles.statCard} elevation={0}>
            <Card.Content style={styles.statContent}>
              <Icon name="calendar-week" size={32} color="#2196F3" />
              <Title style={styles.statValue}>{stats.weeklyXP || 0}</Title>
              <Paragraph style={styles.statLabel}>Weekly XP</Paragraph>
            </Card.Content>
          </Card>

          <Card style={styles.statCard} elevation={0}>
            <Card.Content style={styles.statContent}>
              <Icon name="star" size={32} color="#FFD700" />
              <Title style={styles.statValue}>{stats.totalXP || 0}</Title>
              <Paragraph style={styles.statLabel}>Total XP</Paragraph>
            </Card.Content>
          </Card>
        </View>

        {/* Next Challenge Card */}
        {nextChallenge && (
          <Card style={styles.nextChallengeCard} elevation={0}>
            <Card.Content>
              <View style={styles.nextChallengeHeader}>
                <Icon name="arrow-right-circle" size={32} color="#6200ee" />
                <Title style={styles.nextChallengeTitle}>Next Challenge</Title>
              </View>
              <Paragraph style={styles.challengeName}>{nextChallenge.name}</Paragraph>
              <Paragraph style={styles.challengeDescription}>
                {nextChallenge.description}
              </Paragraph>
              <View style={styles.difficultyBadge}>
                <Paragraph style={styles.difficultyText}>
                  Difficulty: {nextChallenge.difficulty}
                </Paragraph>
              </View>
              <View style={styles.challengeButtonContainer}>
                <Card
                  style={styles.challengeButton}
                  onPress={() => navigation.navigate('Challenge', { type: 'target' })}
                  elevation={0}
                >
                  <Card.Content style={styles.challengeButtonContent}>
                    <Icon name="target" size={24} color="#fff" />
                    <Paragraph style={styles.challengeButtonText}>Target Tapping</Paragraph>
                  </Card.Content>
                </Card>
                <Card
                  style={[styles.challengeButton, styles.challengeButtonSecond]}
                  onPress={() => navigation.navigate('Challenge', { type: 'color' })}
                  elevation={0}
                >
                  <Card.Content style={styles.challengeButtonContent}>
                    <Icon name="circle" size={24} color="#fff" />
                    <Paragraph style={styles.challengeButtonText}>Color Reaction</Paragraph>
                  </Card.Content>
                </Card>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Achievement Progress */}
        <Card style={styles.achievementCard} elevation={0}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Achievement Progress</Title>
            <View style={styles.achievementItem}>
              <Icon name="medal" size={24} color="#FFD700" />
              <View style={styles.achievementInfo}>
                <Paragraph style={styles.achievementName}>First Steps</Paragraph>
                <Paragraph style={styles.achievementDesc}>
                  Complete your first challenge
                </Paragraph>
                <ProgressBar
                  progress={stats.challengesCompleted >= 1 ? 1 : 0}
                  color="#FFD700"
                  style={styles.achievementProgress}
                />
              </View>
            </View>
            <View style={styles.achievementItem}>
              <Icon name="trophy" size={24} color="#FF9800" />
              <View style={styles.achievementInfo}>
                <Paragraph style={styles.achievementName}>Level Up</Paragraph>
                <Paragraph style={styles.achievementDesc}>
                  Reach Level 5
                </Paragraph>
                <ProgressBar
                  progress={Math.min(1, (stats.level || 1) / 5)}
                  color="#FF9800"
                  style={styles.achievementProgress}
                />
              </View>
            </View>
            <View style={styles.achievementItem}>
              <Icon name="star-circle" size={24} color="#9C27B0" />
              <View style={styles.achievementInfo}>
                <Paragraph style={styles.achievementName}>XP Master</Paragraph>
                <Paragraph style={styles.achievementDesc}>
                  Earn 10,000 XP
                </Paragraph>
                <ProgressBar
                  progress={Math.min(1, (stats.totalXP || 0) / 10000)}
                  color="#9C27B0"
                  style={styles.achievementProgress}
                />
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Game Recommendations */}
        <Card style={styles.recommendationCard} elevation={0}>
          <Card.Content>
            <View style={styles.recommendationHeader}>
              <Icon name="controller-classic" size={32} color="#FF5722" />
              <Title style={styles.recommendationTitle}>Hot Games To Try</Title>
            </View>
            {recommendationsLoading ? (
              <ActivityIndicator />
            ) : recommendations.length === 0 ? (
              <Paragraph style={styles.recommendationEmpty}>
                Unable to load recommendations right now.
              </Paragraph>
            ) : (
              recommendations.map((game) => (
                <View key={game.id} style={styles.recommendationItem}>
                  <Title style={styles.recommendationName}>{game.name}</Title>
                  <Paragraph style={styles.recommendationMeta}>
                    {game.genres.length > 0 ? game.genres.join(', ') : 'Genres unavailable'}
                  </Paragraph>
                  <View style={styles.recommendationBadges}>
                    {typeof game.rating === 'number' && (
                      <View style={styles.badge}>
                        <Paragraph style={styles.badgeText}>
                          User ★ {game.rating.toFixed(1)}
                        </Paragraph>
                      </View>
                    )}
                    {typeof game.metacritic === 'number' && (
                      <View style={[styles.badge, styles.metacriticBadge]}>
                        <Paragraph style={styles.badgeText}>
                          Metacritic {game.metacritic}
                        </Paragraph>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
            <Paragraph style={styles.recommendationFooter}>Data provided by RAWG.io</Paragraph>
          </Card.Content>
        </Card>

        {/* Regional Tournaments */}
        <Card style={styles.tournamentCard} elevation={0}>
          <Card.Content>
            <View style={styles.tournamentHeader}>
              <Icon name="map-marker-radius" size={32} color="#4CAF50" />
              <Title style={styles.tournamentTitle}>Regional Tournaments</Title>
            </View>
            {regionLoading ? (
              <ActivityIndicator />
            ) : regionError ? (
              <Paragraph style={styles.tournamentError}>
                {regionError}. Enable location services to see events near you.
              </Paragraph>
            ) : (
              <>
                <Paragraph style={styles.tournamentLocation}>
                  Showing events for {regionInfo.city}, {regionInfo.region}, {regionInfo.country}
                </Paragraph>
                {getTournamentList(regionInfo).map((event) => (
                  <View key={event.id} style={styles.tournamentItem}>
                    <Title style={styles.tournamentName}>{event.name}</Title>
                    <Paragraph style={styles.tournamentGame}>{event.game}</Paragraph>
                    <Paragraph style={styles.tournamentDetails}>
                      {event.date} • {event.format}
                    </Paragraph>
                  </View>
                ))}
              </>
            )}
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a9630ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  mainCard: {
    marginBottom: 16,
    backgroundColor: '#ffffffff',
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  levelInfo: {
    marginLeft: 16,
  },
  levelText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6200ee',
  },
  xpText: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6200ee',
  },
  progressBar: {
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  xpNeeded: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    marginBottom: 12,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  nextChallengeCard: {
    marginBottom: 16,
  },
  nextChallengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  nextChallengeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  challengeName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#6200ee',
  },
  challengeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  difficultyBadge: {
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  difficultyText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  challengeButtonContainer: {
    marginTop: 8,
    flexDirection: 'row',
  },
  challengeButton: {
    flex: 1,
    backgroundColor: '#6200ee',
    marginRight: 6,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  challengeButtonSecond: {
    backgroundColor: '#4CAF50',
    marginRight: 0,
    marginLeft: 6,
  },
  challengeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  challengeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  achievementCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  achievementItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  achievementInfo: {
    flex: 1,
    marginLeft: 12,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  achievementProgress: {
    height: 6,
    borderRadius: 3,
  },
  recommendationCard: {
    marginBottom: 16,
    backgroundColor: '#ffffffff',
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recommendationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  recommendationItem: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 12,
  },
  recommendationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6200ee',
    marginBottom: 4,
  },
  recommendationMeta: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  recommendationBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  metacriticBadge: {
    backgroundColor: '#E3F2FD',
  },
  recommendationEmpty: {
    fontSize: 14,
    color: '#666',
  },
  recommendationFooter: {
    marginTop: 12,
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  tournamentCard: {
    marginBottom: 16,
    backgroundColor: '#ffffffff',
  },
  tournamentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tournamentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  tournamentLocation: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  tournamentItem: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 12,
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6200ee',
    marginBottom: 4,
  },
  tournamentGame: {
    fontSize: 13,
    color: '#444',
    marginBottom: 4,
  },
  tournamentDetails: {
    fontSize: 12,
    color: '#666',
  },
  tournamentError: {
    fontSize: 14,
    color: '#666',
  },
});

