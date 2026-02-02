import React, { useState, useEffect } from 'react';
import {View, StyleSheet, ScrollView, TouchableOpacity} from 'react-native';
import {Card, Title, Paragraph, Button} from 'react-native-paper';
import {signOut} from 'firebase/auth';
import {firebase_auth} from '../utils/firebaseConfig';
import {Alert} from 'react-native';
import {MaterialCommunityIcons as Icon} from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserStats, initializeUserProfile } from '../utils/gameUtils';

export default function HomeScreen({navigation}) {
    // Store user statistics (level, XP, etc.)
    const [userStats, setUserStats] = useState(null);
    // Get safe area insets to avoid notches/status bars
    const insets = useSafeAreaInsets();

    // Load user stats when screen mounts
    useEffect(() => {
        loadUserStats();
    }, []);

    // Fetch user statistics from Firebase and display them
    const loadUserStats = async () => {
        const user = firebase_auth.currentUser;
        if (user) {
            try {
                // Ensure user profile exists in database
                await initializeUserProfile(user.uid, user.email);
                // Get current user stats (level, XP, challenges completed)
                const stats = await getUserStats(user.uid);
                setUserStats(stats);
            } catch (error) {
                console.error('Error loading user stats:', error);
            }
        }
    };

    // Handle user sign out from Firebase
    const handleSignOut = async () => {
        try {
            await signOut(firebase_auth);
            // Navigation will automatically redirect to sign in due to auth state change
        } catch (e) {
            Alert.alert("Error", "Failed to sign out");
        }
    };

    return (
        <ScrollView 
            style={styles.container}
            contentContainerStyle={[styles.contentContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}
        >
            <View style={styles.content}>
                <Card style={styles.welcomeCard} elevation={0}>
                    <Card.Content>
                        <Title style={styles.title}>GameUp</Title>
                        <Paragraph style={styles.subtitle}>
                            Your Personal Gaming Coach
                        </Paragraph>
                        {userStats && (
                            <View style={styles.quickStats}>
                                <View style={styles.quickStatItem}>
                                    <Icon name="trophy" size={20} color="#FFD700" />
                                    <Paragraph style={styles.quickStatText}>
                                        Level {userStats.level || 1}
                                    </Paragraph>
                                </View>
                                <View style={styles.quickStatItem}>
                                    <Icon name="star" size={20} color="#FFD700" />
                                    <Paragraph style={styles.quickStatText}>
                                        {userStats.totalXP || 0} XP
                                    </Paragraph>
                                </View>
                            </View>
                        )}
                    </Card.Content>
                </Card>

                <TouchableOpacity onPress={() => navigation.navigate('Challenge', { type: 'target' })}>
                    <Card style={styles.featureCard} elevation={0}>
                        <Card.Content>
                            <View style={styles.featureRow}>
                                <Icon name="target" size={32} color="#FF5722" />
                                <View style={styles.featureText}>
                                    <Title>Target Tapping</Title>
                                    <Paragraph>Tap targets as fast as you can in 30 seconds</Paragraph>
                                </View>
                            </View>
                        </Card.Content>
                    </Card>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('Challenge', { type: 'color' })}>
                    <Card style={styles.featureCard} elevation={0}>
                        <Card.Content>
                            <View style={styles.featureRow}>
                                <Icon name="circle" size={32} color="#FF5722" />
                                <View style={styles.featureText}>
                                    <Title>Color Reaction</Title>
                                    <Paragraph>Test your reaction speed - click when green!</Paragraph>
                                </View>
                            </View>
                        </Card.Content>
                    </Card>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('Stats')}>
                    <Card style={styles.featureCard} elevation={0}>
                        <Card.Content>
                            <View style={styles.featureRow}>
                                <Icon name="chart-line" size={32} color="#2196F3" />
                                <View style={styles.featureText}>
                                    <Title>Stats & Progress</Title>
                                    <Paragraph>Track your XP, level, and performance metrics</Paragraph>
                                </View>
                            </View>
                        </Card.Content>
                    </Card>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('Leaderboard')}>
                    <Card style={styles.featureCard} elevation={0}>
                        <Card.Content>
                            <View style={styles.featureRow}>
                                <Icon name="trophy" size={32} color="#FFD700" />
                                <View style={styles.featureText}>
                                    <Title>Leaderboard</Title>
                                    <Paragraph>Compete with friends and players worldwide</Paragraph>
                                </View>
                            </View>
                        </Card.Content>
                    </Card>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('Storage')}>
                    <Card style={styles.featureCard} elevation={0}>
                        <Card.Content>
                            <View style={styles.featureRow}>
                                <Icon name="notebook-edit" size={32} color="#6200ee" />
                                <View style={styles.featureText}>
                                    <Title>Notes</Title>
                                    <Paragraph>Save your training notes and thoughts</Paragraph>
                                </View>
                            </View>
                        </Card.Content>
                    </Card>
                </TouchableOpacity>

                <Button
                    mode="outlined"
                    onPress={handleSignOut}
                    style={styles.signOutButton}
                    icon="logout"
                >
                    Sign Out
                </Button>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#2a9630ff',
    },
    content: {
        padding: 16,
    },
    welcomeCard: {
        marginBottom: 16,
        backgroundColor: '#ffffffff',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#000000ff',
        textAlign: 'center',
    },
    subtitle: {
        color: '#000000ff',
        textAlign: 'center',
        fontSize: 16,
        opacity: 0.9,
    },
    quickStats: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 16,
    },
    quickStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 12,
    },
    quickStatText: {
        color: '#000000ff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    featureCard: {
        backgroundColor: '#ffffffff',
        marginBottom: 12,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    featureText: {
        marginLeft: 16,
        flex: 1,
    },
    signOutButton: {
        backgroundColor: '#FF5722',
        marginTop: 5,
    },
});

