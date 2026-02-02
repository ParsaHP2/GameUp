import React, {useState, useEffect} from 'react';
import {View, StyleSheet, ScrollView, Alert, TextInput} from 'react-native';
import {Card, Title, Paragraph, Button} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {MaterialCommunityIcons as Icon} from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NOTES_KEY = 'user_notes';

export default function StorageScreen() {
    const [notes, setNotes] = useState([]);
    const [noteInput, setNoteInput] = useState('');
    const insets = useSafeAreaInsets();

    // Load notes when screen mounts
    useEffect(() => {
        loadNotes();
    }, []);

    // Load notes from AsyncStorage
    const loadNotes = async () => {
        try {
            const data = await AsyncStorage.getItem(NOTES_KEY);
            if (data) {
                setNotes(JSON.parse(data));
            }
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    };

    // Save note to AsyncStorage
    const saveNote = async () => {
        if (!noteInput.trim()) {
            Alert.alert('Error', 'Please enter a note');
            return;
        }

        try {
            const newNote = {
                id: Date.now().toString(),
                text: noteInput.trim(),
                timestamp: new Date().toISOString(),
            };
            const updatedNotes = [...notes, newNote];
            await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(updatedNotes));
            setNotes(updatedNotes);
            setNoteInput('');
        } catch (error) {
            Alert.alert('Error', 'Failed to save note');
        }
    };

    // Delete a note
    const deleteNote = async (id) => {
        try {
            const updatedNotes = notes.filter(note => note.id !== id);
            await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(updatedNotes));
            setNotes(updatedNotes);
        } catch (error) {
            Alert.alert('Error', 'Failed to delete note');
        }
    };

    return (
        <ScrollView 
            style={styles.container}
            contentContainerStyle={[styles.contentContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}
        >
            <View style={styles.content}>
                <Card style={styles.inputCard} elevation={0}>
                    <Card.Content>
                        <View style={styles.headerRow}>
                            <Icon name="notebook-edit" size={24} color="#6200ee" />
                            <Title style={styles.sectionTitle}>Notes</Title>
                        </View>
                        
                        <TextInput
                            style={styles.input}
                            placeholder="Write your note here..."
                            value={noteInput}
                            onChangeText={setNoteInput}
                            multiline
                            numberOfLines={4}
                            placeholderTextColor="#999"
                        />

                        <Button
                            mode="contained"
                            onPress={saveNote}
                            style={styles.saveButton}
                            icon="content-save"
                        >
                            Save Note
                        </Button>
                    </Card.Content>
                </Card>

                {notes.length === 0 ? (
                    <Card style={styles.emptyCard} elevation={0}>
                        <Card.Content style={styles.emptyContent}>
                            <Icon name="notebook-outline" size={48} color="#ccc" />
                            <Paragraph style={styles.emptyText}>
                                No notes yet. Start writing!
                            </Paragraph>
                        </Card.Content>
                    </Card>
                ) : (
                    <>
                        <Title style={styles.notesTitle}>Saved Notes</Title>
                        {notes.map((note) => (
                            <Card key={note.id} style={styles.noteCard} elevation={0}>
                                <Card.Content>
                                    <Paragraph style={styles.noteText}>{note.text}</Paragraph>
                                    <View style={styles.noteFooter}>
                                        <Paragraph style={styles.timestamp}>
                                            {new Date(note.timestamp).toLocaleString()}
                                        </Paragraph>
                                        <Button
                                            mode="text"
                                            onPress={() => deleteNote(note.id)}
                                            icon="delete"
                                            textColor="#f44336"
                                            compact
                                        >
                                            Delete
                                        </Button>
                                    </View>
                                </Card.Content>
                            </Card>
                        ))}
                    </>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#2a9630ff',
    },
    contentContainer: {
        paddingBottom: 24,
    },
    content: {
        padding: 16,
    },
    inputCard: {
        marginBottom: 16,
        backgroundColor: '#ffffffff',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginLeft: 8,
        color: '#000000ff',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        backgroundColor: '#f9f9f9',
        textAlignVertical: 'top',
        minHeight: 100,
        fontSize: 14,
        color: '#000',
    },
    saveButton: {
        paddingVertical: 4,
    },
    notesTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#ffffffff',
    },
    noteCard: {
        marginBottom: 12,
        backgroundColor: '#ffffffff',
    },
    noteText: {
        fontSize: 14,
        color: '#333',
        marginBottom: 8,
        lineHeight: 20,
    },
    noteFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timestamp: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
    },
    emptyCard: {
        backgroundColor: '#ffffffff',
        marginTop: 16,
    },
    emptyContent: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        textAlign: 'center',
        color: '#999',
        marginTop: 12,
        fontSize: 14,
    },
});
