import React, {useState, useEffect} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {onAuthStateChanged} from 'firebase/auth';
import {firebase_auth} from './src/utils/firebaseConfig';
import {NavigationContainer} from '@react-navigation/native';
import {Provider as PaperProvider, DefaultTheme} from 'react-native-paper';
import SignInScreen from './src/screens/SignInScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChallengeScreen from './src/screens/ChallengeScreen';
import StatsScreen from './src/screens/StatsScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import StorageScreen from './src/screens/StorageScreen';

// Custom theme that disables shadows for a flat design
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#6200ee',
  },
  // Disable elevation/shadows for all components
  elevation: {
    level0: 0,
    level1: 0,
    level2: 0,
    level3: 0,
    level4: 0,
    level5: 0,
  },
};

const Stack = createNativeStackNavigator();
const ProtectedStack = createNativeStackNavigator();

// Protected area contains all screens that require authentication
function ProtectedArea(){
  return (
    <ProtectedStack.Navigator>
      <ProtectedStack.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{title: 'GameUp'}}
      />
      <ProtectedStack.Screen 
        name="Challenge" 
        component={ChallengeScreen} 
        options={{title: 'Challenge', headerShown: false}}
      />
      <ProtectedStack.Screen 
        name="Stats" 
        component={StatsScreen} 
        options={{title: 'Stats'}}
      />
      <ProtectedStack.Screen 
        name="Leaderboard" 
        component={LeaderboardScreen} 
        options={{title: 'Leaderboard'}}
      />
      <ProtectedStack.Screen 
        name="Storage" 
        component={StorageScreen} 
        options={{title: 'Notes'}}
      />
    </ProtectedStack.Navigator>
  );
}

export default function App(){
  // Track current authenticated user
  const [user, setUser] = useState(null);
  // Track if Firebase auth state is still loading
  const [initializing, setInitializing] = useState(true);

  // Listen to Firebase authentication state changes
  // This automatically updates when user signs in or out
  useEffect(()=>{
    const unsubscribe = onAuthStateChanged(firebase_auth, (u) => {
      setUser(u);
      if(initializing) setInitializing(false);
     });
     // Cleanup: unsubscribe when component unmounts
     return unsubscribe;
  }, [initializing]);

  // Show nothing while checking auth state (splash screen shows)
  if(initializing) {
    return null; // Loading state - app will show splash screen
  }

  // Render navigation based on authentication status
  // If user is logged in, show protected screens, otherwise show sign in
  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator>
          {user ? (
            // User is authenticated - show main app screens
            <Stack.Screen 
              name="Protected" 
              component={ProtectedArea} 
              options={{headerShown: false}}
            />
          ) : (
            // User is not authenticated - show sign in screen
            <Stack.Screen 
              name="SignIn" 
              component={SignInScreen} 
              options={{title: "Welcome", headerShown: false}}
            />
          )}
        </Stack.Navigator>  
      </NavigationContainer>
    </PaperProvider>
  );
}
