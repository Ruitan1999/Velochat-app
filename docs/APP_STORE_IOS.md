# Submit VeloChat to the App Store (iOS)

## Before you start

- **Apple Developer account** ($99/year): https://developer.apple.com
- **App created in App Store Connect** with the same bundle ID as in `app.json` (e.g. `com.yourname.velochat`). Create it at https://appstoreconnect.apple.com → Apps → + → New App.

---

## 1. Set your bundle identifier

In **`app.json`**, set a unique iOS bundle identifier (must match the app in App Store Connect):

```json
"ios": {
  "bundleIdentifier": "com.yourcompany.velochat",
  ...
}
```

Replace `com.yourname.velochat` / `com.yourcompany.velochat` with your own (e.g. `com.velochat.app`).

---

## 2. Configure EAS Submit (one-time)

Edit **`eas.json`** and replace the placeholders in `submit.production.ios`:

| Key | Where to get it |
|-----|------------------|
| **appleId** | Your Apple ID email (e.g. you@company.com) |
| **appleTeamId** | Apple Developer → Membership → Team ID (10 characters) |
| **ascAppId** | App Store Connect → Your app → App Information → **Apple ID** (numeric, e.g. 1234567890) |

Example:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "you@example.com",
      "ascAppId": "1234567890",
      "appleTeamId": "ABCD123456"
    },
    ...
  }
}
```

---

## 3. Build for App Store

From the project root:

```bash
npx eas-cli build --platform ios --profile production
```

Or use the script:

```bash
npm run build:ios:store
```

- Log in to Expo when prompted if needed.
- Wait for the build to finish on Expo’s servers (link appears in the terminal).
- When the build is **finished**, note the build ID or use “latest” in the next step.

---

## 4. Submit the build to App Store Connect

After the production build has completed:

```bash
npx eas-cli submit --platform ios --profile production --latest
```

Or:

```bash
npm run submit:ios
```

- `--latest` submits the most recent production iOS build.
- EAS will use the credentials from `eas.json` (or prompt for Apple ID password / app-specific password if needed).

---

## 5. In App Store Connect

1. Open your app in App Store Connect.
2. The new build should appear under the version (e.g. 1.0.1) after processing (often 5–15 minutes).
3. Select the build, fill in version info, screenshots, description, etc., and submit for review.

---

## OneSignal

The app is set to use OneSignal in **production** mode for the store build. Push notifications will use your production OneSignal app/config.

---

## Troubleshooting

- **“No builds found”**  
  Run the production iOS build first (`npm run build:ios:store`) and wait until it’s finished.

- **Apple ID / 2FA**  
  Use an **app-specific password** for your Apple ID if prompted: https://appleid.apple.com → Sign-In and Security → App-Specific Passwords.

- **Missing compliance / encryption**  
  The app already has `ITSAppUsesNonExemptEncryption: false` in `app.json`; if App Store Connect still asks, answer the export compliance question accordingly.
