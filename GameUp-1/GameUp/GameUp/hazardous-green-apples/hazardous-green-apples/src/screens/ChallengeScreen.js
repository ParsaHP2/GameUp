import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Alert, Dimensions, Text } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { firebase_auth } from '../utils/firebaseConfig';
import { updateUserStats, initializeUserProfile } from '../utils/gameUtils';
import { Button } from '../components/Button';

const { width, height } = Dimensions.get('window');
const GAME_DURATION = 30; // 60 seconds for target tapping
const TARGET_SIZE = 60;
const CIRCLE_SIZE = 120; // Size for color reaction circle
const MIN_WAIT_TIME = 1000; // Minimum wait before turning green (1 second)
const MAX_WAIT_TIME = 4000; // Maximum wait before turning green (4 seconds)
const MAX_COLOR_ROUNDS = 10; // Maximum rounds for color reaction game
const COLOR_SCORE_XP_DIVISOR = 10; // Divide color score by this to normalize XP gain (similar to target tapping)

// Calculate points based on reaction time (ms)
// Faster reactions = more points
// Formula: Points = max(0, 1000 - reactionTime) / 10
// This gives 100 points for 0ms, ~50 points for 500ms, 0 points for 1000ms+
const calculateReactionScore = (reactionTimeMs) => {
  // Cap at 1000ms - reactions slower than 1 second get 0 points
  if (reactionTimeMs >= 1000) return 0;
  // Faster reactions get exponentially more points
  // 0-200ms: 80-100 points (excellent)
  // 200-400ms: 60-80 points (good)
  // 400-600ms: 40-60 points (average)
  // 600-800ms: 20-40 points (slow)
  // 800-1000ms: 0-20 points (very slow)
  return Math.max(0, Math.floor((1000 - reactionTimeMs) / 10));
};

const StartCard = ({ iconName, iconColor, title, description, loading, onStart }) => (
  <Card style={styles.startCard} elevation={0}>
    <Card.Content style={styles.startContent}>
      <Icon name={iconName} size={64} color={iconColor} />
      <Title style={styles.startTitle}>{title}</Title>
      <Paragraph style={styles.startDescription}>{description}</Paragraph>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <Button mode="contained" onPress={onStart} style={styles.startButton} icon="play">
          Start Challenge
        </Button>
      )}
    </Card.Content>
  </Card>
);

const PauseCard = ({ onResume }) => (
  <Card style={styles.pauseCard} elevation={0}>
    <Card.Content style={styles.pauseContent}>
      <Icon name="pause-circle" size={64} color="#FF9800" />
      <Title style={styles.pauseTitle}>Game Paused</Title>
      <Button mode="contained" onPress={onResume} style={styles.resumeButton} icon="play">
        Resume
      </Button>
    </Card.Content>
  </Card>
);

const clearTimeoutRef = (ref) => {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
};

const clearIntervalRef = (ref) => {
  if (ref.current) {
    clearInterval(ref.current);
    ref.current = null;
  }
};

export default function ChallengeScreen({ navigation, route }) {
  // Determine which game mode to play (target tapping or color reaction)
  const challengeType = route?.params?.type || 'target'; // 'target' or 'color'
  
  // Target tapping game state
  const [score, setScore] = useState(0); // Current score (targets hit)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION); // Countdown timer (60 seconds)
  const [targets, setTargets] = useState([]); // Array of active targets on screen
  
  // Color reaction game state
  const [circleColor, setCircleColor] = useState('red'); // Current circle color (red or green)
  const [reactionTime, setReactionTime] = useState(null); // Time taken to react (in milliseconds)
  const [roundsCompleted, setRoundsCompleted] = useState(0); // Number of successful rounds
  const [bestReactionTime, setBestReactionTime] = useState(null); // Fastest reaction time
  const [greenTime, setGreenTime] = useState(null); // Timestamp when circle turns green
  const [isWaiting, setIsWaiting] = useState(false); // Whether waiting for circle to turn green
  const [colorScore, setColorScore] = useState(0); // Accumulated score based on reaction times
  
  // Common game state
  const [isPlaying, setIsPlaying] = useState(false); // Whether game is currently active
  const [isPaused, setIsPaused] = useState(false); // Whether game is paused
  const [gameStarted, setGameStarted] = useState(false); // Whether game has started
  const [loading, setLoading] = useState(false); // Loading state for saving scores
  
  // Refs to store timer IDs so we can clear them properly
  const timerRef = useRef(null); // Main game timer
  const targetSpawnTimerRef = useRef(null); // Timer for spawning new targets
  const targetIdRef = useRef(0); // Unique ID counter for targets
  const colorTimerRef = useRef(null); // Timer for color reaction auto-fail
  const waitTimerRef = useRef(null); // Timer for waiting before turning green
  const roundInProgressRef = useRef(false); // Track if a color round is in progress

  // Target tapping: Countdown timer that decreases every second
  useEffect(() => {
    if (challengeType === 'target' && isPlaying && !isPaused && timeLeft > 0) {
      // Start countdown timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            endGame(); // Game ends when timer reaches 0
            return 0;
          }
          return prev - 1; // Decrease time by 1 second
        });
      }, 1000);
    } else {
      clearIntervalRef(timerRef); // Stop timer if game is paused or stopped
    }

    // Cleanup: clear timer when component unmounts or dependencies change
    return () => {
      clearIntervalRef(timerRef);
    };
  }, [challengeType, isPlaying, isPaused, timeLeft]);

  // Target tapping: Spawn new targets periodically
  useEffect(() => {
    if (challengeType === 'target' && isPlaying && !isPaused) {
      spawnTarget(); // Spawn first target immediately
      // Spawn new target every 1.5 seconds
      targetSpawnTimerRef.current = setInterval(() => {
        spawnTarget();
      }, 1500);
    } else {
      clearIntervalRef(targetSpawnTimerRef); // Stop spawning if game is paused
    }

    // Cleanup: clear spawn timer when component unmounts or dependencies change
    return () => {
      clearIntervalRef(targetSpawnTimerRef);
    };
  }, [challengeType, isPlaying, isPaused]);

  // Color reaction: Start new round when game is active
  useEffect(() => {
    if (challengeType === 'color' && isPlaying && !isPaused && !roundInProgressRef.current) {
      startColorRound(); // Start new round (circle turns red, then green after random delay)
    }

    // Cleanup: clear timers only when game stops or pauses
    return () => {
      if (!isPlaying || isPaused) {
        clearTimeoutRef(waitTimerRef);
        clearTimeoutRef(colorTimerRef);
        roundInProgressRef.current = false;
      }
    };
  }, [challengeType, isPlaying, isPaused, roundsCompleted]);

  // Create a new target at a random position on screen
  const spawnTarget = () => {
    const newTarget = {
      id: targetIdRef.current++, // Give each target a unique ID
      x: Math.random() * (width - TARGET_SIZE - 40) + 20, // Random X position
      y: Math.random() * (height * 0.5 - TARGET_SIZE - 100) + 100, // Random Y position
      scale: new Animated.Value(0), // Start with scale 0 for animation
    };

    // Add new target to the targets array
    setTargets((prev) => [...prev, newTarget]);

    // Animate target appearing with a spring animation
    Animated.spring(newTarget.scale, {
      toValue: 1, // Scale from 0 to 1
      friction: 3,
      tension: 40,
      useNativeDriver: true, // Use native driver for better performance
    }).start();

    // Remove target after 3 seconds if not clicked
    setTimeout(() => {
      setTargets((prev) => prev.filter((t) => t.id !== newTarget.id));
    }, 3000);
  };

  // Handle when user taps a target
  const handleTargetPress = (targetId) => {
    setScore((prev) => prev + 1); // Increment score
    setTargets((prev) => prev.filter((t) => t.id !== targetId)); // Remove target from screen
  };

  // Start a new round of color reaction game
  const startColorRound = () => {
    roundInProgressRef.current = true;
    setIsWaiting(true);
    setCircleColor('red'); // Start with red circle
    setReactionTime(null);
    
    // Random wait time between 1-4 seconds before turning green
    const waitTime = Math.random() * (MAX_WAIT_TIME - MIN_WAIT_TIME) + MIN_WAIT_TIME;
    
    // Wait for random time, then turn circle green
    waitTimerRef.current = setTimeout(() => {
      setCircleColor('green');
      setGreenTime(Date.now()); // Record when circle turned green
      setIsWaiting(false);
      
      // Auto-fail if user doesn't click within 3 seconds of green
      colorTimerRef.current = setTimeout(() => {
        handleColorMiss();
      }, 3000);
    }, waitTime);
  };

  // Handle user clicking the circle
  const handleColorPress = () => {
    if (circleColor === 'red') {
      // User clicked too early - game over
      handleColorFail();
    } else if (circleColor === 'green' && greenTime) {
      // User clicked when green - calculate reaction time
      const clickTime = Date.now();
      const reaction = clickTime - greenTime; // Time difference in milliseconds
      setReactionTime(reaction);
      
      // Calculate points based on reaction time
      const pointsEarned = calculateReactionScore(reaction);
      setColorScore((prev) => prev + pointsEarned);
      
      // Update best reaction time if this is faster
      if (!bestReactionTime || reaction < bestReactionTime) {
        setBestReactionTime(reaction);
      }
      
      // Clear the auto-fail timer since user clicked in time
      clearTimeoutRef(colorTimerRef);
      
      // Check if we've reached the round limit
      const newRoundCount = roundsCompleted + 1;
      if (newRoundCount >= MAX_COLOR_ROUNDS) {
        // Game complete - end the game
        setTimeout(() => {
          endColorGame();
        }, 1500);
      } else {
        // Wait 1.5 seconds, then start next round
        setTimeout(() => {
          setReactionTime(null);
          roundInProgressRef.current = false; // Mark round as complete
          setRoundsCompleted(newRoundCount); // This will trigger useEffect to start next round
        }, 1500);
      }
    }
  };

  const handleColorFail = async () => {
    setIsPlaying(false);
    setGameStarted(false);
    clearTimeoutRef(waitTimerRef);
    clearTimeoutRef(colorTimerRef);
    roundInProgressRef.current = false;
    
    // Save score if player completed any rounds
    if (colorScore > 0) {
      const user = firebase_auth.currentUser;
      if (user) {
        setLoading(true);
        try {
          await initializeUserProfile(user.uid, user.email);
          // Divide color score by divisor to normalize XP gain (similar to target tapping)
          const normalizedScore = Math.floor(colorScore / COLOR_SCORE_XP_DIVISOR);
          const updatedStats = await updateUserStats(user.uid, normalizedScore);
          Alert.alert(
            'Game Over!',
            `You clicked too early!\n\nScore: ${colorScore} points\nRounds: ${roundsCompleted}/${MAX_COLOR_ROUNDS}\nBest Reaction: ${bestReactionTime || 'N/A'}ms\nXP Gained: ${updatedStats.xpGained}`,
            [
              { text: 'Try Again', onPress: () => { resetColorGame(); setLoading(false); } },
              {
                text: 'Back to Home',
                onPress: () => {
                  navigation.goBack();
                  setLoading(false);
                },
              },
            ]
          );
        } catch (error) {
          Alert.alert('Error', 'Failed to save score: ' + error.message);
          setLoading(false);
        }
      } else {
        Alert.alert(
          'Game Over!',
          'You clicked too early! Wait for the circle to turn green.',
          [
            { text: 'Try Again', onPress: resetColorGame },
            {
              text: 'Back to Home',
              onPress: () => {
                navigation.goBack();
              },
            },
          ]
        );
      }
    } else {
      Alert.alert(
        'Game Over!',
        'You clicked too early! Wait for the circle to turn green.',
        [
          { text: 'Try Again', onPress: resetColorGame },
          {
            text: 'Back to Home',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    }
  };

  const handleColorMiss = async () => {
    setIsPlaying(false);
    setGameStarted(false);
    clearTimeoutRef(waitTimerRef);
    roundInProgressRef.current = false;
    
    // Save score if player completed any rounds
    if (colorScore > 0) {
      const user = firebase_auth.currentUser;
      if (user) {
        setLoading(true);
        try {
          await initializeUserProfile(user.uid, user.email);
          // Divide color score by divisor to normalize XP gain (similar to target tapping)
          const normalizedScore = Math.floor(colorScore / COLOR_SCORE_XP_DIVISOR);
          const updatedStats = await updateUserStats(user.uid, normalizedScore);
          Alert.alert(
            'Game Over!',
            `You took too long!\n\nScore: ${colorScore} points\nRounds: ${roundsCompleted}/${MAX_COLOR_ROUNDS}\nBest Reaction: ${bestReactionTime || 'N/A'}ms\nXP Gained: ${updatedStats.xpGained}`,
            [
              { text: 'Try Again', onPress: () => { resetColorGame(); setLoading(false); } },
              {
                text: 'Back to Home',
                onPress: () => {
                  navigation.goBack();
                  setLoading(false);
                },
              },
            ]
          );
        } catch (error) {
          Alert.alert('Error', 'Failed to save score: ' + error.message);
          setLoading(false);
        }
      } else {
        Alert.alert(
          'Game Over!',
          'You took too long! Click as soon as the circle turns green.',
          [
            { text: 'Try Again', onPress: resetColorGame },
            {
              text: 'Back to Home',
              onPress: () => {
                navigation.goBack();
              },
            },
          ]
        );
      }
    } else {
      Alert.alert(
        'Game Over!',
        'You took too long! Click as soon as the circle turns green.',
        [
          { text: 'Try Again', onPress: resetColorGame },
          {
            text: 'Back to Home',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    }
  };

  const resetColorGame = () => {
    setCircleColor('red');
    setReactionTime(null);
    setRoundsCompleted(0);
    setBestReactionTime(null);
    setGreenTime(null);
    setIsWaiting(false);
    setGameStarted(false);
    setColorScore(0);
    roundInProgressRef.current = false;
  };

  // End color reaction game after completing all rounds
  const endColorGame = async () => {
    setIsPlaying(false);
    setIsPaused(false);
    clearTimeoutRef(waitTimerRef);
    clearTimeoutRef(colorTimerRef);
    roundInProgressRef.current = false;

    const user = firebase_auth.currentUser;
    if (user && colorScore > 0) {
      setLoading(true);
      try {
        // Ensure user profile exists
        await initializeUserProfile(user.uid, user.email);
        
        // Save color reaction score (based on accumulated reaction time points)
        // Divide color score by divisor to normalize XP gain (similar to target tapping)
        const normalizedScore = Math.floor(colorScore / COLOR_SCORE_XP_DIVISOR);
        const updatedStats = await updateUserStats(user.uid, normalizedScore);
        Alert.alert(
          'Challenge Complete!',
          `Score: ${colorScore} points\nRounds: ${MAX_COLOR_ROUNDS}/${MAX_COLOR_ROUNDS}\nBest Reaction: ${bestReactionTime}ms\nXP Gained: ${updatedStats.xpGained}\nLevel: ${updatedStats.level}`,
          [
            {
              text: 'Play Again',
              onPress: () => {
                resetColorGame();
                setLoading(false);
              },
            },
            {
              text: 'Back to Home',
              onPress: () => {
                navigation.goBack();
                setLoading(false);
              },
            },
          ]
        );
      } catch (error) {
        Alert.alert('Error', 'Failed to save score: ' + error.message);
        setLoading(false);
      }
    } else {
      // No score to save, just reset
      resetColorGame();
    }
  };

  const startGame = () => {
    if (challengeType === 'target') {
      setScore(0);
      setTimeLeft(GAME_DURATION);
      setTargets([]);
    } else {
      // Reset color game state
      setCircleColor('red');
      setReactionTime(null);
      setRoundsCompleted(0);
      setBestReactionTime(null);
      setGreenTime(null);
      setIsWaiting(false);
      setColorScore(0);
      roundInProgressRef.current = false;
    }
    setIsPlaying(true);
    setIsPaused(false);
    setGameStarted(true);
  };

  const pauseGame = () => {
    setIsPaused(true);
    if (challengeType === 'color') {
      clearTimeoutRef(waitTimerRef);
      clearTimeoutRef(colorTimerRef);
    }
  };

  const resumeGame = () => {
    setIsPaused(false);
  };

  // End the game and save score to Firebase
  const endGame = async () => {
    setIsPlaying(false);
    setIsPaused(false);
    setTargets([]); // Clear all targets
    
    // Clear all timers
    clearIntervalRef(timerRef);
    clearIntervalRef(targetSpawnTimerRef);

    const user = firebase_auth.currentUser;
    if (user) {
      setLoading(true);
      try {
        // Ensure user profile exists
        await initializeUserProfile(user.uid, user.email);
        
        if (challengeType === 'target' && score > 0) {
          // Save target tapping score and update user stats
          const updatedStats = await updateUserStats(user.uid, score);
          Alert.alert(
            'Challenge Complete!',
            `Score: ${score}\nXP Gained: ${updatedStats.xpGained}\nLevel: ${updatedStats.level}`,
            [
              {
                text: 'Play Again',
                onPress: () => {
                  setGameStarted(false);
                  setLoading(false);
                },
              },
              {
                text: 'Back to Home',
                onPress: () => {
                  navigation.goBack();
                  setLoading(false);
                },
              },
            ]
          );
        } else {
          setGameStarted(false);
          setLoading(false);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to save score: ' + error.message);
        setLoading(false);
      }
    } else {
      setGameStarted(false);
    }
  };

  const handleBack = () => {
    if (isPlaying) {
      Alert.alert(
        'Pause Game?',
        'Are you sure you want to leave? Your progress will be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              setIsPlaying(false);
              setTargets([]);
              setGameStarted(false);
              clearIntervalRef(timerRef);
              clearIntervalRef(targetSpawnTimerRef);
              clearTimeoutRef(waitTimerRef);
              clearTimeoutRef(colorTimerRef);
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const renderTargetChallenge = () => {
    if (!gameStarted) {
      return (
        <StartCard
          iconName="target"
          iconColor="#6200ee"
          title="Target Tapping Challenge"
          description={`Tap targets as fast as you can!\nYou have ${GAME_DURATION} seconds to score as many points as possible.`}
          loading={loading}
          onStart={startGame}
        />
      );
    }

    if (isPaused) {
      return <PauseCard onResume={resumeGame} />;
    }

    return (
      <>
        {targets.map((target) => (
          <View
            key={target.id}
            style={[
              styles.target,
              {
                left: target.x,
                top: target.y,
              },
            ]}
          >
            <Animated.View
              style={{
                width: '100%',
                height: '100%',
                transform: [{ scale: target.scale }],
              }}
            >
              <TouchableOpacity
                style={styles.targetButton}
                onPress={() => handleTargetPress(target.id)}
                activeOpacity={0.7}
              >
                <Icon name="target" size={TARGET_SIZE} color="#FF5722" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        ))}
        {targets.length === 0 && isPlaying && (
          <View style={styles.emptyArea}>
            <Paragraph style={styles.waitingText}>
              Targets will appear soon...
            </Paragraph>
          </View>
        )}
      </>
    );
  };

  const renderColorChallenge = () => {
    if (!gameStarted) {
      return (
        <StartCard
          iconName="circle"
          iconColor="#FF5722"
          title="Color Reaction Challenge"
          description={`Wait for the circle to turn green, then click as fast as you can!\nComplete ${MAX_COLOR_ROUNDS} rounds. Faster reactions = more points!\nClicking when red will end the game.`}
          loading={loading}
          onStart={startGame}
        />
      );
    }

    if (isPaused) {
      return <PauseCard onResume={resumeGame} />;
    }

    return (
      <View style={styles.colorGameArea}>
        <TouchableOpacity
          style={[
            styles.colorCircle,
            {
              backgroundColor: circleColor === 'red' ? '#F44336' : '#4CAF50',
            },
          ]}
          onPress={handleColorPress}
          activeOpacity={0.8}
        />
        
        {/* Minimalistic stats */}
        <View style={styles.colorStats}>
          {reactionTime !== null && (
            <Text style={styles.reactionTimeText}>
              {reactionTime}ms
            </Text>
          )}
          {bestReactionTime !== null && (
            <Text style={styles.bestReactionText}>
              Best: {bestReactionTime}ms
            </Text>
          )}
          <Text style={styles.roundsText}>
            Round {roundsCompleted + 1}/{MAX_COLOR_ROUNDS}
          </Text>
          <Text style={styles.scoreText}>
            Score: {colorScore} points
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Button
          mode="text"
          onPress={handleBack}
          icon="arrow-left"
          textColor="#6200ee"
        >
          Back
        </Button>
        <View style={styles.headerInfo}>
          {challengeType === 'target' ? (
            <>
              <View style={[styles.infoItem, styles.infoItemFirst]}>
                <Icon name="timer" size={20} color="#6200ee" />
                <Title style={[styles.timerText, styles.infoTextMargin]}>{timeLeft}s</Title>
              </View>
              <View style={styles.infoItem}>
                <Icon name="target" size={20} color="#4CAF50" />
                <Title style={[styles.scoreText, styles.infoTextMargin]}>{score}</Title>
              </View>
            </>
          ) : (
            <View style={[styles.infoItem, styles.infoItemFirst]}>
              <Icon name="circle" size={20} color={circleColor === 'red' ? '#F44336' : '#4CAF50'} />
              <Title style={[styles.scoreText, styles.infoTextMargin]}>
                {roundsCompleted}/{MAX_COLOR_ROUNDS}
              </Title>
            </View>
          )}
        </View>
        {isPlaying && (
          <Button
            mode="text"
            onPress={isPaused ? resumeGame : pauseGame}
            icon={isPaused ? 'play' : 'pause'}
            textColor="#6200ee"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
        )}
      </View>

      {/* Game Area */}
      <View style={styles.gameArea}>
        {challengeType === 'target' ? renderTargetChallenge() : renderColorChallenge()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a9630ff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 24,
  },
  infoItemFirst: {
    marginLeft: 0,
  },
  infoTextMargin: {
    marginLeft: 8,
  },
  timerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6200ee',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  gameArea: {
    flex: 1,
    position: 'relative',
  },
  target: {
    position: 'absolute',
    width: TARGET_SIZE,
    height: TARGET_SIZE,
  },
  targetButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingText: {
    fontSize: 16,
    color: '#999',
  },
  startCard: {
    backgroundColor: '#ffffffff',
    margin: 20,
  },
  startContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  startTitle: {
    color: '#000000ff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  startDescription: {
    textAlign: 'center',
    color: '#00000085',
    marginBottom: 24,
    lineHeight: 22,
  },
  startButton: {
    marginTop: 8,
    paddingVertical: 4,
  },
  pauseCard: {
    margin: 20,
  },
  pauseContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  pauseTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 24,
  },
  resumeButton: {
    marginTop: 8,
    paddingVertical: 4,
  },
  // Color reaction styles
  colorGameArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorStats: {
    marginTop: 40,
    alignItems: 'center',
  },
  reactionTimeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  bestReactionText: {
    fontSize: 18,
    color: '#00000085',
    marginBottom: 4,
  },
  roundsText: {
    fontSize: 16,
    color: '#00000085',
  },
});
