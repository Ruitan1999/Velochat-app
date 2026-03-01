# OneSignal push notifications setup (ride chat messages)

VeloChat uses OneSignal for push notifications on ride chat messages. OneSignal targets users by **external user ID** (your Supabase user ID), so no token storage in the database is needed.

## 1. Create a OneSignal app

1. Go to [OneSignal](https://onesignal.com) and sign in or create an account.
2. Create a new app (or use an existing one).
3. Choose **Google (FCM)** for Android and **Apple (APNs)** for iOS.
4. For **Android**: Upload your FCM server key or `google-services.json` (you already have this for VeloChat).
5. For **iOS**: Upload your APNs key (.p8) or certificate (.p12).
6. Copy your **OneSignal App ID** (from Dashboard → Settings → Keys & IDs).
7. Create a **REST API Key** (Dashboard → Settings → Keys & IDs → REST API Key) and copy it.

## 2. Configure the app

1. In `app.json`, set your OneSignal App ID:
   ```json
   "extra": {
     ...
     "onesignalAppId": "YOUR_ACTUAL_ONESIGNAL_APP_ID"
   }
   ```

2. For production builds, change the plugin mode in `app.json`:
   ```json
   ["onesignal-expo-plugin", { "mode": "production" }]
   ```

## 3. Configure the Edge Function

1. In **Supabase Dashboard** → **Edge Functions** → **send-notification** → **Secrets**.
2. Add:
   - `ONESIGNAL_APP_ID` = your OneSignal App ID
   - `ONESIGNAL_REST_API_KEY` = your OneSignal REST API Key

3. Redeploy the function:
   ```bash
   supabase functions deploy send-notification
   ```

## 4. Build and test

- Push notifications **do not work in Expo Go**. Use a development or preview build:
  ```bash
  eas build --profile preview --platform android
  ```
- Install the build on a device, sign in, and send a message in a ride chat. Other participants should receive a push notification.
- Tapping the notification should open the chat.

## 5. How to check if notifications are working

### A. OneSignal Dashboard – confirm the device is subscribed

1. Open [OneSignal Dashboard](https://onesignal.com) → your app.
2. Go to **Audience** → **All Users** (or **Subscribed Users**).
3. Install your **development build** on a **physical device**, open the app, and **sign in**.
4. In the dashboard, click **Check Subscribed Users** (or refresh). You should see at least one subscriber with an **External User ID** = your Supabase user ID (a UUID).
5. If you see a subscribed user with that external ID, the app is correctly registering with OneSignal.

### B. Send a real chat message (two devices or two accounts)

1. **Device A**: Sign in as User 1. Create or open a ride, open the ride chat.
2. **Device B**: Sign in as User 2 (different account). Open the same ride chat so both are participants.
3. **Device A**: Send a message in the chat.
4. **Device B**: Put the app in the **background** (home button) or lock the screen. Within a few seconds you should get a push notification (“User 1: message text”).
5. Tap the notification → the app should open to that chat room.

### C. OneSignal “Send test message” (optional)

1. In OneSignal Dashboard → **Messages** → **New Push**.
2. Under **Audience**, choose **Send to Test Users** or **Send to Particular Users** and target by **External User ID** = the Supabase user UUID of the account you’re signed in as on the device.
3. Send the message. Your device should receive it if the device is subscribed and the external ID matches.

## Flow

1. User signs in → `OneSignal.login(supabaseUserId)` links the device to that user.
2. New message in ride chat → DB trigger calls `send-notification` with `recipientIds` (chat participants except sender).
3. Edge Function sends to OneSignal API with `include_external_user_ids: recipientIds`.
4. OneSignal delivers to all devices linked to those user IDs.
