import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, BackHandler } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Button, TextInput as PaperTextInput, Dialog, Portal } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { firebase_auth } from '../utils/firebaseConfig';
import { getLeaderboard, addFriendByUsername, initializeUserProfile } from '../utils/gameUtils';

export default function LeaderboardScreen({ navigation }) {
  // Current active tab: 'global', 'friends', or 'weekly'
  const [activeTab, setActiveTab] = useState('global');
  // Leaderboard data (array of user entries)
  const [leaderboard, setLeaderboard] = useState([]);
  // Loading state for initial load
  const [loading, setLoading] = useState(true);
  // Loading state for pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  // Whether add friend dialog is visible
  const [friendDialogVisible, setFriendDialogVisible] = useState(false);
  // Username input for adding friend
  const [friendUsername, setFriendUsername] = useState('');
  // Loading state for adding friend
  const [addingFriend, setAddingFriend] = useState(false);
  // Current user's rank in leaderboard
  const [userRank, setUserRank] = useState(null);

  // Reload leaderboard when tab changes
  useEffect(() => {
    loadLeaderboard();
  }, [activeTab]);

  // Close dialog when screen loses focus (navigating away)
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // Cleanup: close dialog when screen loses focus
        setFriendDialogVisible(false);
        setFriendUsername('');
      };
    }, [])
  );

  // Handle Android back button press when Dialog is visible
  useEffect(() => {
    if (friendDialogVisible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        setFriendDialogVisible(false);
        setFriendUsername('');
        return true; // Prevent default back behavior (close dialog instead)
      });

      return () => {
        backHandler.remove(); // Cleanup: remove event listener
      };
    }
  }, [friendDialogVisible]);

  // Load leaderboard data from Firebase
  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const user = firebase_auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      // Ensure user profile exists
      await initializeUserProfile(user.uid, user.email);

      // Get leaderboard data based on active tab
      const data = await getLeaderboard(activeTab, user.uid);
      setLeaderboard(data);

      // Find user's rank in the leaderboard
      const userIndex = data.findIndex((entry) => entry.userId === user.uid);
      if (userIndex !== -1) {
        setUserRank(userIndex + 1); // Rank is 1-based (1st, 2nd, etc.)
      } else {
        setUserRank(null); // User not in leaderboard
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      Alert.alert('Error', 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  // Handle pull-to-refresh - reload leaderboard
  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  // Add a friend by username
  const handleAddFriend = async () => {
    if (!friendUsername.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    setAddingFriend(true);
    try {
      const user = firebase_auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Add friend to user's friends list in Firestore
      await addFriendByUsername(user.uid, friendUsername.trim());
      Alert.alert('Success', `Added ${friendUsername} as a friend!`);
      setFriendDialogVisible(false);
      setFriendUsername('');
      
      // Reload leaderboard if on friends tab to show new friend
      if (activeTab === 'friends') {
        await loadLeaderboard();
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to add friend');
    } finally {
      setAddingFriend(false);
    }
  };

  // Get icon and color for rank (gold for 1st, silver for 2nd, bronze for 3rd)
  const getRankIcon = (rank) => {
    if (rank === 1) return { name: 'trophy', color: '#FFD700' }; // Gold
    if (rank === 2) return { name: 'trophy', color: '#C0C0C0' }; // Silver
    if (rank === 3) return { name: 'trophy', color: '#CD7F32' }; // Bronze
    return { name: 'numeric-' + rank + '-circle', color: '#666' }; // Number for others
  };

  // Get the XP value to display based on tab (weekly or total)
  const getRankValue = (tab) => {
    return tab === 'weekly' ? 'weeklyXP' : 'totalXP';
  };

  const currentUser = firebase_auth.currentUser;

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <Button
          mode={activeTab === 'global' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('global')}
          style={styles.tab}
          icon="earth"
        >
          Global
        </Button>
        <Button
          mode={activeTab === 'friends' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('friends')}
          style={styles.tab}
          icon="account-group"
        >
          Friends
        </Button>
        <Button
          mode={activeTab === 'weekly' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('weekly')}
          style={styles.tab}
          icon="calendar-week"
        >
          Weekly
        </Button>
      </View>

      {/* Add Friend Button (only on Friends tab) */}
      {activeTab === 'friends' && (
        <View style={styles.addFriendContainer}>
          <Button
            mode="outlined"
            onPress={() => setFriendDialogVisible(true)}
            icon="account-plus"
            style={styles.addFriendButton}
          >
            Add Friend
          </Button>
        </View>
      )}

      {/* Leaderboard */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : leaderboard.length === 0 ? (
        <Card style={styles.emptyCard} elevation={0}>
          <Card.Content style={styles.emptyContent}>
            <Icon name="trophy-outline" size={64} color="#ccc" />
            <Title style={styles.emptyTitle}>No Rankings Yet</Title>
            <Paragraph style={styles.emptyText}>
              {activeTab === 'friends'
                ? 'Add friends to see their rankings!'
                : 'Complete challenges to appear on the leaderboard!'}
            </Paragraph>
          </Card.Content>
        </Card>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.content}>
            {/* User's Rank Highlight */}
            {userRank && (
              <Card style={styles.userRankCard} elevation={0}>
                <Card.Content>
                  <View style={styles.userRankHeader}>
                    <Icon name="account-circle" size={32} color="#6200ee" />
                    <View style={styles.userRankInfo}>
                      <Paragraph style={styles.userRankText}>
                        Your Rank: #{userRank}
                      </Paragraph>
                      <Paragraph style={styles.userRankXP}>
                        {getRankValue(activeTab) === 'weeklyXP'
                          ? leaderboard[userRank - 1]?.weeklyXP || 0
                          : leaderboard[userRank - 1]?.totalXP || 0}{' '}
                        XP
                      </Paragraph>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            )}

            {/* Leaderboard List */}
            {leaderboard.map((entry, index) => {
              const rank = index + 1;
              const rankIcon = getRankIcon(rank);
              const isCurrentUser = entry.userId === currentUser?.uid;
              const xpValue = getRankValue(activeTab) === 'weeklyXP' ? entry.weeklyXP : entry.totalXP;

              return (
                <Card
                  key={entry.userId}
                  style={[styles.leaderboardCard, isCurrentUser && styles.currentUserCard]}
                  elevation={0}
                >
                  <Card.Content style={styles.leaderboardContent}>
                    <View style={styles.rankContainer}>
                      {rank <= 3 ? (
                        <Icon name={rankIcon.name} size={32} color={rankIcon.color} />
                      ) : (
                        <View style={styles.rankNumber}>
                          <Paragraph style={styles.rankText}>#{rank}</Paragraph>
                        </View>
                      )}
                    </View>

                    <View style={styles.userInfo}>
                      <View style={styles.userHeader}>
                        <Title style={styles.username}>
                          {entry.username}
                          {isCurrentUser && ' (You)'}
                        </Title>
                        {isCurrentUser && (
                          <Icon name="account-circle" size={20} color="#6200ee" />
                        )}
                      </View>
                      <View style={styles.userStats}>
                        <View style={styles.statItem}>
                          <Icon name="star" size={16} color="#FFD700" />
                          <Paragraph style={[styles.statText, styles.statTextMargin]}>{xpValue} XP</Paragraph>
                        </View>
                        <View style={styles.statItem}>
                          <Icon name="trophy" size={16} color="#FF9800" />
                          <Paragraph style={[styles.statText, styles.statTextMargin]}>Level {entry.level}</Paragraph>
                        </View>
                        <View style={styles.statItem}>
                          <Icon name="target" size={16} color="#4CAF50" />
                          <Paragraph style={[styles.statText, styles.statTextMargin]}>
                            Best: {entry.bestScore}
                          </Paragraph>
                        </View>
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Add Friend Dialog - Only render when visible to avoid BackHandler issues */}
      {friendDialogVisible && (
        <Portal>
          <Dialog
            visible={friendDialogVisible}
            dismissable={false}
            onDismiss={() => {
              setFriendDialogVisible(false);
              setFriendUsername('');
            }}
          >
            <Dialog.Title>Add Friend</Dialog.Title>
            <Dialog.Content>
              <PaperTextInput
                label="Username"
                value={friendUsername}
                onChangeText={setFriendUsername}
                mode="outlined"
                autoCapitalize="none"
                placeholder="Enter username"
              />
              <Paragraph style={styles.dialogHint}>
                Enter the username of the friend you want to add
              </Paragraph>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setFriendDialogVisible(false)}>Cancel</Button>
              <Button
                onPress={handleAddFriend}
                loading={addingFriend}
                disabled={addingFriend}
              >
                Add
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a9630ff',
  },
  tabs: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    marginHorizontal: 4,
  },
  addFriendContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  addFriendButton: {
    alignSelf: 'flex-start',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  userRankCard: {
    marginBottom: 16,
    backgroundColor: '#E8EAF6',
  },
  userRankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userRankInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userRankText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6200ee',
  },
  userRankXP: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  leaderboardCard: {
    marginBottom: 12,
  },
  currentUserCard: {
    backgroundColor: '#E8EAF6',
    borderWidth: 2,
    borderColor: '#6200ee',
  },
  leaderboardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankContainer: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  userStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  statTextMargin: {
    marginLeft: 4,
  },
  emptyCard: {
    margin: 20,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
  },
  dialogHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
});

