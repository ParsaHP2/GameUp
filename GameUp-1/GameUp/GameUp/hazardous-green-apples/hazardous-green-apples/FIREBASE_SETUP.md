# Firebase Firestore Setup - Fix "Missing or insufficient permissions"

The "Missing or insufficient permissions" error means your Firestore Security Rules need to be updated in the Firebase Console.

## Quick Fix (Copy & Paste)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **iat359firebasetest-609b1**
3. In the left sidebar, click **Firestore Database**
4. Click the **Rules** tab
5. **Replace** the entire rules content with the rules from `firestore.rules` in this folder (or copy below)
6. Click **Publish**

## Rules to Use

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    match /userStats/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## What These Rules Do

- **Authenticated users only**: All operations require `request.auth != null` (user must be signed in)
- **users**: Users can read any profile (for leaderboard, add friend), but only write their own
- **userStats**: Users can read any stats (for leaderboard), but only write their own

## Deploy via Firebase CLI (Optional)

If you have Firebase CLI installed:

```bash
firebase deploy --only firestore:rules
```

You'll need a `firebase.json` that references `firestore.rules` - the file is already in this folder.
