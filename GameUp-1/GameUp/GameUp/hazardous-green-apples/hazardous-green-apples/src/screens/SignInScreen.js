import {createUserWithEmailAndPassword, signInWithEmailAndPassword} from 'firebase/auth';
import {useState} from 'react';
import {firebase_auth} from '../utils/firebaseConfig';
import {Alert, StyleSheet, View, KeyboardAvoidingView, Platform} from 'react-native';
import {TextInput, Card, Title, Paragraph} from 'react-native-paper';
import {Button} from '../components/Button';

export default function SignInScreen(){
    // Store email and password input values
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    // Track loading state to disable buttons during auth operations
    const [loading, setLoading] = useState(false);

    // Create a new user account with email and password
    const handleSignUp = async () => {
        // Validate input fields are not empty
        if(!email.trim() || !password.trim()) {
            Alert.alert("Error", "Please enter both email and password");
            return;
        }
        // Firebase requires password to be at least 6 characters
        if(password.length < 6) {
            Alert.alert("Error", "Password must be at least 6 characters");
            return;
        }
        try {
            setLoading(true);
            // Create user account in Firebase
            await createUserWithEmailAndPassword(firebase_auth, email.trim(), password);
            Alert.alert("Success", "Account created successfully!");
            // App will automatically navigate to home screen due to auth state change
        } catch (e){
            Alert.alert("Failed to create account", e.message);
        } finally {
            setLoading(false);
        }
    };

    // Sign in existing user with email and password
    const handleSignIn = async () => {
        // Validate input fields are not empty
        if(!email.trim() || !password.trim()) {
            Alert.alert("Error", "Please enter both email and password");
            return;
        }
        try {
            setLoading(true);
            // Authenticate user with Firebase
            await signInWithEmailAndPassword(firebase_auth, email.trim(), password);
            // App will automatically navigate to home screen due to auth state change
        } catch (e){
            Alert.alert("Sign in failed", e.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.content}>
                <Card style={styles.card} elevation={0}>
                    <Card.Content>
                        <Title style={styles.title}>GameUp</Title>
                        <Paragraph style={styles.subtitle}>Your Personal Gaming Coach</Paragraph>
                        <Paragraph style={styles.subtitle}>Sign in or create an account</Paragraph>
                        
                        <View style={styles.inputContainer}>
                            <TextInput
                                label="Email"
                                value={email}
                                onChangeText={setEmail}
                                mode="flat"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                style={styles.input}
                                disabled={loading}
                                underlineColor="transparent"
                                activeUnderlineColor="#6200ee"
                            />
                        </View>
                        
                        <View style={styles.inputContainer}>
                            <TextInput
                                label="Password"
                                value={password}
                                onChangeText={setPassword}
                                mode="flat"
                                secureTextEntry
                                style={styles.input}
                                disabled={loading}
                                underlineColor="transparent"
                                activeUnderlineColor="#6200ee"
                            />
                        </View>
                        
                        <View style={styles.buttonWrapper}>
                            <Button
                                mode="contained"
                                onPress={handleSignIn}
                                style={styles.button}
                                loading={loading}
                                disabled={loading}
                            >
                                Sign In
                            </Button>
                        </View>
                        
                        <View style={styles.buttonWrapper}>
                            <Button
                                mode="outlined"
                                onPress={handleSignUp}
                                style={styles.button}
                                loading={loading}
                                disabled={loading}
                            >
                                Sign Up
                            </Button>
                        </View>
                    </Card.Content>
                </Card>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#2a9630ff',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        borderRadius: 8,
        backgroundColor: '#ffffffff',
    },
    title: {
        textAlign: 'center',
        marginBottom: 8,
        fontSize: 28,
        fontWeight: 'bold',
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 24,
        color: '#00000085',
    },
    inputContainer: {
        marginBottom: 16,
        backgroundColor: '#f5f5f5',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    input: {
        backgroundColor: 'transparent',
    },
    buttonWrapper: {
        marginTop: 8,
    },
    button: {
        paddingVertical: 4,
    },
});

