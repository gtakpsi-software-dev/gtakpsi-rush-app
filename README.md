# GT AKPsi Rush App

A React + Rust full stack application using Railway (backend), Vercel (frontend), Firebase Storage (images), and MongoDB.

## Tech Stack

- **Frontend**: React + Vite, hosted on Vercel
- **Backend**: Rust + Axum, hosted on Railway
- **Database**: MongoDB Atlas
- **Image Storage**: Firebase Storage
- **Real-time**: Redis (for voting)

## Environment Variables

### Client (.env in /client)

```env
VITE_API_PREFIX=https://your-railway-backend-url.railway.app
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### Server (.env in /server)

```env
MONGO_URL=mongodb+srv://...
REDIS_URL=rediss://...
```

### Setup Script (.env in root)

```env
API=https://your-railway-backend-url.railway.app
FIREBASE_CREDENTIALS_PATH=firebase-service-account.json
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

## Deploy

### Frontend (Vercel)

The frontend is deployed automatically via Vercel when you push to the main branch.

Manual deploy:
```bash
cd client
npm run build
# Deploy to Vercel via CLI or dashboard
```

### Backend (Railway)

The backend is deployed automatically via Railway when you push to the main branch.

Railway will use the Dockerfile in the `/server` folder.

## Setup Script

Before each rush season, run the setup script to clear old data:

```bash
pip install pymongo python-dotenv tqdm firebase-admin
python setup.py
```

This will:
- Clear all rushees from MongoDB
- Clear all rush nights and PIS timeslots
- Delete all profile pictures from Firebase Storage
- Re-add rush nights, PIS timeslots, and questions from JSON files
