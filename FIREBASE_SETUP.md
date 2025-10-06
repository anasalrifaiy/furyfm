# Firebase Setup for Fury FM

## 🔐 Authentication Configuration

### 1. Enable Email/Password Authentication

1. Go to [Firebase Console - Authentication](https://console.firebase.google.com/project/fury-fm/authentication/providers)
2. Click on **"Email/Password"** provider
3. Enable both:
   - ✅ Email/Password
   - ✅ Email link (passwordless sign-in) - Optional
4. Click **"Save"**

### 2. Add Authorized Domains

Firebase only allows authentication from authorized domains for security.

1. Go to [Authentication Settings](https://console.firebase.google.com/project/fury-fm/authentication/settings)
2. Scroll to **"Authorized domains"** section
3. You should already have:
   - ✅ `localhost` (for development)
   - ✅ `fury-fm.firebaseapp.com` (auto-added)

4. **Add your GitHub Pages domain:**
   - Click **"Add domain"**
   - Enter: `anasalrifaiy.github.io`
   - Click **"Add"**

### 3. Database Rules (Already configured)

Your Realtime Database rules should allow authenticated users:

```json
{
  "rules": {
    "managers": {
      "$uid": {
        ".read": true,
        ".write": "$uid === auth.uid"
      }
    },
    "market": {
      ".read": true,
      ".write": "auth != null"
    },
    "tradeOffers": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

If not set, go to [Realtime Database Rules](https://console.firebase.google.com/project/fury-fm/database/fury-fm-default-rtdb/rules)

---

## 🌐 Deployment Domains

### Development
- **URL:** http://localhost:3000
- **Status:** ✅ Already authorized by Firebase

### Production (GitHub Pages)
- **URL:** https://anasalrifaiy.github.io/furyfm
- **Status:** ⚠️ Need to add `anasalrifaiy.github.io` to authorized domains

### Production (Firebase Hosting) - Alternative
- **URL:** https://fury-fm.web.app
- **Status:** ✅ Auto-authorized

---

## 🐛 Troubleshooting Authentication Issues

### Error: "auth/unauthorized-domain"
**Solution:** Add your domain to authorized domains (see Step 2 above)

### Error: "auth/operation-not-allowed"
**Solution:** Enable Email/Password authentication (see Step 1 above)

### Error: "Firebase: Error (auth/network-request-failed)"
**Solution:** Check your internet connection and Firebase project status

### Sign up/Login button does nothing
**Causes:**
1. Domain not authorized
2. Email/Password not enabled
3. JavaScript console errors (press F12 to check)

**Solution:**
1. Open browser console (F12)
2. Try to sign up/login
3. Check the error message
4. Follow error-specific solution above

---

## 📝 Quick Verification Steps

1. ✅ Email/Password enabled in Firebase Console
2. ✅ `anasalrifaiy.github.io` added to authorized domains
3. ✅ Database rules allow authenticated writes
4. ✅ No console errors in browser (F12)

---

## 🚀 After Configuration

1. Clear browser cache (Ctrl+Shift+Delete)
2. Refresh your site: https://anasalrifaiy.github.io/furyfm
3. Try to create an account
4. Should work! 🎉

---

## 📞 Still Having Issues?

Check the browser console (F12) and share the error message for specific help.
