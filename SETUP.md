# AVault Setup Guide

## Initial Admin Setup - Step by Step

### Step 1: Sign In to Your App
1. Start your Next.js app: `npm run dev`
2. Open `http://localhost:3000` in your browser
3. Click **"Sign in with Google"**
4. Complete the Google authentication
5. You'll see an "Access Denied" message (this is expected for now)

### Step 2: Access Firebase Console
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Sign in with the same Google account you used for AVault
3. Select your Firebase project (the one you configured in `.env.local`)

### Step 3: Navigate to Firestore Database
1. In the left sidebar, click **"Firestore Database"** (or "Build" → "Firestore Database")
2. You should see your database interface

### Step 4: Find the Users Collection
1. In the Firestore interface, look for a collection called **`users`**
2. If you don't see it yet:
   - It will be created automatically after you sign in
   - Refresh the page or wait a moment
   - The collection appears after the first user signs in

### Step 5: Locate Your User Document
1. Click on the **`users`** collection to expand it
2. You'll see documents with IDs (these are Firebase Auth UIDs)
3. To find your document:
   - Look for the document that has your email address in the `email` field
   - Or check the `displayName` field if it matches your Google account name
   - You can click on each document to view its contents

### Step 6: Edit Your User Document
1. **Click on your user document** (the one with your email)
2. You'll see the document fields in a table format
3. Look for these fields:
   - `email` (should be your email)
   - `isAdmin` (probably `false` or missing)
   - `isAuthorized` (probably `false`)

### Step 7: Update the Fields
1. **Click the "Edit document" button** (pencil icon) or double-click a field
2. You need to add/update these fields:

   **Field 1: `isAdmin`**
   - Click "Add field" or find existing `isAdmin` field
   - Field name: `isAdmin`
   - Field type: Select **"boolean"**
   - Value: **`true`** (check the box or type `true`)
   - Click "Update"

   **Field 2: `isAuthorized`**
   - Click "Add field" or find existing `isAuthorized` field
   - Field name: `isAuthorized`
   - Field type: Select **"boolean"**
   - Value: **`true`** (check the box or type `true`)
   - Click "Update"

3. **Click "Update"** or "Save" to save the document

### Step 8: Verify It Worked
1. Go back to your AVault app (`http://localhost:3000`)
2. **Refresh the page** (or sign out and sign back in)
3. You should now see the **Dashboard** instead of "Access Denied"
4. In the Quick Actions sidebar, you should see **"Manage Users"** link
5. Click it to go to `/users` - you should be able to access it!

### Visual Guide - What Your Document Should Look Like

Your user document should have these fields:
```
id: "your-firebase-uid"
email: "your-email@gmail.com"
displayName: "Your Name" (optional)
photoURL: "https://..." (optional)
lastLoginAt: [timestamp]
createdAt: [timestamp]
isAdmin: true ← YOU ADD THIS
isAuthorized: true ← YOU ADD THIS
```

## User Management Flow

1. **New user signs in with Google** → User record created with `isAuthorized: false`
2. **Admin goes to `/users` page** → Sees pending users
3. **Admin clicks "Grant Access"** → User can now access the site
4. **Unauthorized users** → See "Access Denied" message when trying to access

## Making Additional Admins

To make another user an admin (after they've signed in):

1. Go to Firebase Console → Firestore Database
2. Click on the **`users`** collection
3. Find the user's document (by email)
4. Click to edit the document
5. Add/update the `isAdmin` field:
   - Field name: `isAdmin`
   - Field type: **boolean**
   - Value: **`true`**
6. Save the document
7. That user can now access `/users` page

## Troubleshooting

**Problem: I don't see the `users` collection**
- Solution: Make sure you've signed in to your app at least once. The collection is created automatically on first sign-in.

**Problem: I can't find my user document**
- Solution: Check all documents in the `users` collection. Each document ID is a Firebase Auth UID. Look at the `email` field in each document to find yours.

**Problem: I updated the fields but still see "Access Denied"**
- Solution: 
  - Make sure you saved the document in Firestore
  - Refresh your browser or sign out and sign back in
  - Check that both `isAdmin` and `isAuthorized` are set to `true` (boolean, not string)

**Problem: The fields show as strings instead of booleans**
- Solution: When adding the field, make sure to select "boolean" as the field type, not "string". If you accidentally created it as a string, delete the field and add it again as a boolean.

