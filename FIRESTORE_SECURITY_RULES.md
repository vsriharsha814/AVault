# Firestore Security Rules Setup

## Important: Firestore Security Rules

**If your Firestore database was created in "Production mode" (which is the default), it blocks ALL reads and writes until you configure security rules.**

This is why the `users` collection isn't being created - the security rules are preventing writes. You **must** configure security rules to allow authenticated users to write to the `users` collection.

## Step-by-Step: Configure Firestore Security Rules

### Step 1: Go to Firestore Rules
1. Open [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click **"Firestore Database"** in the left sidebar
4. Click on the **"Rules"** tab at the top

### Step 2: Update the Rules
Replace the default rules with these rules that allow authenticated users to read/write their own user document:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - users can read/write their own document
    // Admins can read/write all user documents
    match /users/{userId} {
      // Allow users to create/update their own document
      allow create, update: if request.auth != null && request.auth.uid == userId;
      
      // Allow users to read their own document
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Allow admins to read/write all user documents
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Other collections - adjust as needed for your app
    match /categories/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /items/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /academicTerms/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /inventorySessions/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /inventoryCounts/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /historicalCounts/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Step 3: Publish the Rules
1. Click **"Publish"** button
2. Wait for confirmation that rules are published

### Alternative: Switch to Test Mode (Temporary - Development Only)

If you want to test quickly and your database is in Production mode, you can temporarily switch to Test mode:

1. Go to Firestore Database → **Rules** tab
2. You'll see a banner saying "Your Cloud Firestore security rules are in production mode"
3. Click **"Get started"** or look for a button to switch to test mode
4. This will allow reads/writes for 30 days (⚠️ **NOT secure for production!**)

**⚠️ WARNING:** Test mode allows anyone to read/write your database if they have the Firebase config. Only use this for development and testing!

**Better approach:** Keep production mode and use the proper security rules above - they're more secure and work long-term.

### Step 4: Verify
1. Sign in to your app again
2. Check the browser console for any error messages
3. Go to Firestore Database → `users` collection
4. You should see your user document

## Troubleshooting

**Problem: Still can't create documents**
- Make sure you clicked "Publish" after updating rules
- Wait a few seconds for rules to propagate
- Check browser console for specific error messages
- Verify you're signed in (check Firebase Auth)

**Problem: Permission denied errors**
- Make sure the rules allow writes for authenticated users
- Check that `request.auth != null` is true (user is signed in)
- Verify the user document path matches the rule pattern

**Problem: Rules syntax error**
- Check for typos in the rules
- Make sure all brackets are closed
- Verify `rules_version = '2';` is at the top

