# Push VeloChat to Google Play Store

Two steps: **build** a production Android App Bundle (AAB), then **submit** it to Play Console.

---

## 1. Build the production AAB

From the project root:

```bash
eas build --platform android --profile production
```

- EAS will build an **Android App Bundle** (`.aab`) in the cloud.
- When it finishes, you get a link to the build (e.g. on expo.dev). You can **download the `.aab`** from there.

Your `eas.json` already has `production` with `"buildType": "app-bundle"`, so this is the right build for Play Store.

---

## 2. Submit to Play Store

### Option A: Automatic (EAS Submit) — recommended

EAS can upload the latest build to Play Console for you.

**One-time setup: Google Play service account**

1. In **Google Play Console** → **Setup** → **API access** → link or create a project, then **Create new service account**.
2. Follow the link to **Google Cloud Console**; create a key (JSON) for that service account and **download the JSON file**.
3. In **Play Console** → **Users and permissions** → invite the service account email and give it at least **Release to production** (or the track you use).
4. Put the JSON key in your project (e.g. `./google-play-service-account.json`) and **do not commit it** (add to `.gitignore`).

Your `eas.json` already has:

```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./google-play-service-account.json",
      "track": "production"
    }
  }
}
```

**Submit the latest production build:**

```bash
eas submit --platform android --profile production --latest
```

- `--latest` uses the most recent production build. Or use `--id <build-id>` to pick a specific build.
- EAS will upload the AAB to the **production** track (or change `track` in `eas.json` for internal/testing).

---

### Option B: Manual upload

1. Run the build: `eas build --platform android --profile production`.
2. When it finishes, open the build page (link in terminal or expo.dev dashboard).
3. **Download** the `.aab` file.
4. In **Google Play Console** → your app → **Release** → **Production** (or Testing) → **Create new release**.
5. **Upload** the `.aab`, add release notes, then **Review release** → **Start rollout to Production**.

---

## Checklist before first release

- [ ] **Version:** In `app.json`, `expo.version` (e.g. `"1.0.0"`). For later updates, bump this (and optionally `android.versionCode` if you set it).
- [ ] **Package name:** `app.json` → `expo.android.package` (e.g. `com.yourname.velochat`) must match the application you created in Play Console.
- [ ] **Store listing:** Title, short & full description, screenshots, icon, feature graphic (see `docs/APP_STORE_DESCRIPTIONS.md`).
- [ ] **Content rating:** Questionnaire done in Play Console.
- [ ] **Data safety:** Filled in (see `docs/DATA_SAFETY_PLAY_STORE.md`).
- [ ] **Privacy policy:** URL set in Play Console (see `docs/PRIVACY_POLICY.md`).

---

## Quick reference

| Step | Command |
|------|--------|
| Build AAB | `eas build --platform android --profile production` |
| Submit (after service account setup) | `eas submit --platform android --profile production --latest` |

After the AAB is in Play Console, finish the release (review, rollout to production). New updates: bump version, run the build again, then submit again (or upload the new AAB manually).
