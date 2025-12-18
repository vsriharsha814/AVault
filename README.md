# AVault - Modern AV Inventory Management

A modern, full-stack inventory management system built with **Next.js**, **Firebase Auth**, and **Cloud Firestore**, designed for easy deployment on **Vercel**.

## 🚀 Features

- **Firebase Authentication** - Google Sign-In only
- **Cloud Firestore Database** - Real-time data storage
- **Modern Dashboard** - Clean, responsive UI built with Tailwind CSS
- **Inventory Management** - Track items, categories, and academic terms
- **Session Tracking** - Conduct inventory counts with completion tracking
- **Semester Support** - Organize inventory by academic terms (Spring, Summer, Fall, Winter)

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Authentication**: Firebase Auth
- **Database**: Cloud Firestore
- **Deployment**: Vercel

## 📦 Setup

### Prerequisites

- Node.js 18+ and npm
- A Firebase project with Auth and Firestore enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd AVault
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable **Authentication** → **Sign-in method** → Enable **Google** provider
   - Enable **Cloud Firestore** (start in test mode)
   - Copy your Firebase config values

4. **Configure environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🚢 Deployment to Vercel

1. **Push your code to GitHub**

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Add environment variables**
   - In Vercel project settings, add all your Firebase environment variables
   - Use the same names as in your `.env.local`

4. **Deploy**
   - Click "Deploy"
   - Your app will be live in minutes!

## 📁 Project Structure

```
AVault/
├── app/
│   ├── api/              # API routes
│   ├── components/       # React components
│   ├── lib/              # Utilities (Firebase, Firestore)
│   ├── types/            # TypeScript types
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── public/               # Static assets
├── package.json
└── README.md
```

## 🔥 Firebase Collections

The app uses the following Firestore collections:

- `users` - User accounts (automatically created on Google sign-in)
- `categories` - Equipment categories
- `items` - Individual inventory items
- `academicTerms` - Academic terms (Spring 2024, etc.)
- `inventorySessions` - Counting sessions
- `inventoryCounts` - Item counts per session
- `historicalCounts` - Historical semester data

## 🎯 Usage

1. **Sign in** with your Google account
2. **View Dashboard** - See summary of items, categories, and sessions
3. **Add Items** - Create new inventory items (coming soon)
4. **Create Sessions** - Start new inventory counting sessions (coming soon)
5. **Import from Excel** - Bulk import inventory data (coming soon)

## 🔐 Security

- All data is stored securely in Cloud Firestore
- Firebase Auth handles authentication securely
- Firestore security rules should be configured for production

## 📝 License

This project is designed for internal use. Modify and distribute as needed.

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!
