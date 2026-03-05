# Fix iOS build after changing bundle ID

If you see provisioning profile / App Group mismatches (e.g. old bundle ID in the error):

EAS may be using **old provisioning profiles** or the App Group may not be included. Clear iOS credentials so the next build creates new profiles for **velochat** and **velochat.OneSignalNotificationServiceExtension** with App Group **group.velocha.onesignal**.

## Steps

### 1. Clear iOS credentials on EAS

Run:

```bash
npx eas-cli credentials --platform ios
```

- Choose the build profile you use (e.g. **preview** or **production**).
- Remove or clear the existing **Distribution Certificate** and **Provisioning Profile** (or use “Remove” for the iOS credentials set) so EAS will create new ones on the next build.
- If prompted, confirm you want to remove credentials.

### 2. Run a new build (with cache cleared)

So the native project is regenerated from your current `app.json` (bundle ID `velochat`):

```bash
npm run build:ios:preview:clean
```

Or for production:

```bash
npx eas-cli build --platform ios --profile production --clear-cache
```

The first build after clearing credentials may take longer while EAS creates new provisioning profiles and registers the App Group **group.velocha.onesignal** for the main app and the OneSignal extension.

### 3. (Optional) Clear from Expo dashboard

You can also remove iOS credentials from **[expo.dev](https://expo.dev)** → your project → **Credentials** → **iOS** → remove the existing credentials. Then run the build again.
