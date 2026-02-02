import { doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db, firebase_auth } from './firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_STATS_KEY = 'user_stats_cache';
const XP_PER_SCORE_POINT = 10; // XP gained per score point
const XP_PER_LEVEL = 1000; // XP needed per level

// Initialize user profile and stats in Firestore database
// Creates user document if it doesn't exist
export const initializeUserProfile = async (userId, email) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    // Only create profile if user doesn't exist
    if (!userSnap.exists()) {
      // Create user document in 'users' collection
      await setDoc(userRef, {
        email: email,
        username: email.split('@')[0], // Default username from email (part before @)
        createdAt: new Date().toISOString(),
        level: 1, // Start at level 1
        totalXP: 0, // Start with 0 XP
        challengesCompleted: 0,
        bestScore: 0,
        friends: [], // Empty friends list
        lastChallengeDate: null,
      });
      
      // Initialize stats document in 'userStats' collection
      await setDoc(doc(db, 'userStats', userId), {
        userId: userId,
        level: 1,
        totalXP: 0,
        challengesCompleted: 0,
        bestScore: 0,
        weeklyXP: 0, // Weekly XP resets every 7 days
        lastChallengeDate: null,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error initializing user profile:', error);
    throw error;
  }
};

// Get user stats from Firestore with AsyncStorage caching for performance
// Cache reduces database reads and improves app speed
export const getUserStats = async (userId) => {
  try {
    // Try to get from local cache first (faster than database read)
    const cached = await AsyncStorage.getItem(`${USER_STATS_KEY}_${userId}`);
    if (cached) {
      const cachedData = JSON.parse(cached);
      // If cache is less than 5 minutes old, use cached data
      if (Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
        return cachedData.data;
      }
    }
    
    // Cache expired or doesn't exist - fetch from Firestore database
    const statsRef = doc(db, 'userStats', userId);
    const statsSnap = await getDoc(statsRef);
    
    if (statsSnap.exists()) {
      const data = statsSnap.data();
      // Save to cache for future reads
      await AsyncStorage.setItem(`${USER_STATS_KEY}_${userId}`, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
      return data;
    }
    
    // Return default stats if user doesn't have stats yet
    return {
      level: 1,
      totalXP: 0,
      challengesCompleted: 0,
      bestScore: 0,
      weeklyXP: 0,
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    // Return default stats on error
    return {
      level: 1,
      totalXP: 0,
      challengesCompleted: 0,
      bestScore: 0,
      weeklyXP: 0,
    };
  }
};

// Update user stats after completing a challenge
// Calculates XP, level, and updates all relevant statistics
export const updateUserStats = async (userId, score) => {
  try {
    const statsRef = doc(db, 'userStats', userId);
    const userRef = doc(db, 'users', userId);
    
    // Calculate XP gained based on score (10 XP per point)
    const xpGained = score * XP_PER_SCORE_POINT;
    
    // Get current stats from database
    const statsSnap = await getDoc(statsRef);
    const currentStats = statsSnap.exists() ? statsSnap.data() : {
      totalXP: 0,
      level: 1,
      bestScore: 0,
      challengesCompleted: 0,
      weeklyXP: 0,
    };
    
    // Calculate new values
    const newTotalXP = currentStats.totalXP + xpGained;
    // Level increases every 1000 XP (level = floor(totalXP / 1000) + 1)
    const newLevel = Math.floor(newTotalXP / XP_PER_LEVEL) + 1;
    // Update best score if current score is higher
    const newBestScore = Math.max(currentStats.bestScore || 0, score);
    // Increment challenges completed counter
    const newChallengesCompleted = (currentStats.challengesCompleted || 0) + 1;
    
    // Calculate weekly XP (reset if last challenge was more than 7 days ago)
    const now = new Date();
    const lastChallengeDate = currentStats.lastChallengeDate 
      ? new Date(currentStats.lastChallengeDate) 
      : null;
    // Calculate days since last challenge
    const daysSinceLastChallenge = lastChallengeDate 
      ? (now - lastChallengeDate) / (1000 * 60 * 60 * 24) 
      : 8; // If no last challenge, treat as new week
    
    // Reset weekly XP if it's been more than 7 days, otherwise add to it
    const newWeeklyXP = daysSinceLastChallenge > 7 
      ? xpGained 
      : (currentStats.weeklyXP || 0) + xpGained;
    
    // Update stats document in Firestore
    await updateDoc(statsRef, {
      totalXP: newTotalXP,
      level: newLevel,
      bestScore: newBestScore,
      challengesCompleted: newChallengesCompleted,
      weeklyXP: newWeeklyXP,
      lastChallengeDate: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    
    // Also update user document to keep data in sync
    await updateDoc(userRef, {
      level: newLevel,
      totalXP: newTotalXP,
      challengesCompleted: newChallengesCompleted,
      bestScore: newBestScore,
      lastChallengeDate: now.toISOString(),
    });
    
    // Clear cache so next read gets fresh data from database
    await AsyncStorage.removeItem(`${USER_STATS_KEY}_${userId}`);
    
    // Return updated stats
    return {
      level: newLevel,
      totalXP: newTotalXP,
      xpGained,
      bestScore: newBestScore,
      challengesCompleted: newChallengesCompleted,
      weeklyXP: newWeeklyXP,
    };
  } catch (error) {
    console.error('Error updating user stats:', error);
    throw error;
  }
};

// Get leaderboard data from Firestore
// Supports three types: 'global' (total XP), 'weekly' (weekly XP), 'friends' (friends only)
export const getLeaderboard = async (type = 'global', userId = null) => {
  try {
    const statsRef = collection(db, 'userStats');
    let q;
    
    if (type === 'weekly') {
      // Weekly leaderboard: sorted by weekly XP, descending, top 100
      q = query(statsRef, orderBy('weeklyXP', 'desc'), limit(100));
    } else if (type === 'global') {
      // Global leaderboard: sorted by total XP, descending, top 100
      q = query(statsRef, orderBy('totalXP', 'desc'), limit(100));
    } else {
      // Friends leaderboard - need to get user's friends first
      if (!userId) return [];
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists() || !userSnap.data().friends) return [];
      
      const friends = userSnap.data().friends;
      if (friends.length === 0) return [];
      
      // Get stats for each friend
      const friendStats = [];
      for (const friendId of friends) {
        const friendStatsRef = doc(db, 'userStats', friendId);
        const friendSnap = await getDoc(friendStatsRef);
        if (friendSnap.exists()) {
          friendStats.push(friendSnap.data());
        }
      }
      
      // Sort friends by totalXP, descending
      friendStats.sort((a, b) => (b.totalXP || 0) - (a.totalXP || 0));
      return friendStats;
    }
    
    // Execute query and get results
    const querySnapshot = await getDocs(q);
    const leaderboard = [];
    
    // Process each document and add username from users collection
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      // Get username from users collection (stats only store userId)
      const userRef = doc(db, 'users', data.userId);
      const userSnap = await getDoc(userRef);
      const username = userSnap.exists() ? userSnap.data().username : 'Unknown';
      
      // Add to leaderboard array
      leaderboard.push({
        userId: data.userId,
        username,
        level: data.level || 1,
        totalXP: data.totalXP || 0,
        weeklyXP: data.weeklyXP || 0,
        bestScore: data.bestScore || 0,
        challengesCompleted: data.challengesCompleted || 0,
      });
    }
    
    return leaderboard;
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
};

// Add friend by username
// Searches for user by username and adds them to current user's friends list
export const addFriendByUsername = async (userId, username) => {
  try {
    // Find user by username in Firestore
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error('User not found');
    }
    
    const friendDoc = querySnapshot.docs[0];
    const friendId = friendDoc.id;
    
    // Prevent user from adding themselves
    if (friendId === userId) {
      throw new Error('Cannot add yourself as a friend');
    }
    
    // Get current user's friends list
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const currentFriends = userSnap.exists() ? (userSnap.data().friends || []) : [];
    
    // Check if already friends
    if (currentFriends.includes(friendId)) {
      throw new Error('User is already your friend');
    }
    
    // Add friend ID to friends array
    await updateDoc(userRef, {
      friends: [...currentFriends, friendId],
    });
    
    return friendDoc.data();
  } catch (error) {
    console.error('Error adding friend:', error);
    throw error;
  }
};

// Get next challenge recommendation for user
// Cycles through available challenges based on number of challenges completed
export const getNextChallenge = async (userId) => {
  try {
    const stats = await getUserStats(userId);
    const challengesCompleted = stats.challengesCompleted || 0;
    
    // Simple challenge recommendation based on completion count
    // Cycles through challenges using modulo operator
    const challenges = [
      { name: 'Target Tapping', description: 'Tap targets as fast as you can!', difficulty: 'Easy' },
      { name: 'Color Reaction', description: 'React to color changes quickly', difficulty: 'Medium' },
      { name: 'Precision Aim', description: 'Hit small targets accurately', difficulty: 'Hard' },
    ];
    
    // Use modulo to cycle through challenges
    const challengeIndex = challengesCompleted % challenges.length;
    return challenges[challengeIndex];
  } catch (error) {
    console.error('Error getting next challenge:', error);
    // Return default challenge on error
    return {
      name: 'Target Tapping',
      description: 'Tap targets as fast as you can!',
      difficulty: 'Easy',
    };
  }
};

// Calculate XP needed for next level
// Each level requires level * 1000 XP (e.g., level 2 needs 2000 XP, level 3 needs 3000 XP)
export const getXPForNextLevel = (currentLevel) => {
  return currentLevel * XP_PER_LEVEL;
};

// Calculate XP progress for current level
// Returns current XP in level, XP needed for next level, and progress percentage
export const getXPProgress = (totalXP, level) => {
  // Calculate XP threshold for current level (e.g., level 2 starts at 1000 XP)
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  // Calculate how much XP user has in current level
  const xpInCurrentLevel = totalXP - xpForCurrentLevel;
  // Calculate XP threshold for next level
  const xpNeededForNextLevel = level * XP_PER_LEVEL;
  // Calculate progress percentage (0-100)
  const progress = (xpInCurrentLevel / XP_PER_LEVEL) * 100;
  
  return {
    current: xpInCurrentLevel, // XP user has in current level
    needed: XP_PER_LEVEL, // XP needed to reach next level (always 1000)
    progress: Math.min(100, Math.max(0, progress)), // Progress percentage (clamped between 0-100)
  };
};

