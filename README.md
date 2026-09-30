# Seating Chart & Classroom Manager

An interactive seating chart app for a Smartboard and laptop, with drag-and-drop
seating, random student/row pickers, and a flip-clock countdown timer.

## Running it on your computer

```bash
npm install
npm run dev
```

Then open the web address it prints (something like `http://localhost:5173`).

## Signing in and sync

The app saves everything in the browser it's running in, so it works on one
device with no setup. A teacher who signs in with Google gets their classes
kept in their account, and the same on every computer they sign in on.

That runs on the `class-yes` Firebase project (Google sign-in and a Firestore
database). Its web settings are in [`src/lib/firebase.ts`](./src/lib/firebase.ts);
they name the project and aren't secret. What keeps teachers' classes apart is
the Firestore rules, set in the Firebase console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /teachers/{teacherId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == teacherId;
    }
  }
}
```

A build made with `VITE_FIREBASE_EMULATOR=1` talks to Firebase's local
emulators (auth on port 9099, Firestore on 8080) instead, for testing.

## Building for deployment

```bash
npm run build
```

This produces a `dist/` folder you can host anywhere that serves static
files (Vercel, Netlify, GitHub Pages, etc).
