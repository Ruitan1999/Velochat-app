# Native tooling (iOS / Android)

## CocoaPods (iOS)

If `expo-doctor` reports:

```
✖ Check native tooling versions
CocoaPods version check failed. CocoaPods may not be installed or there may be an issue with your CocoaPods installation. Installing version 1.15.2 or higher is recommended.
```

install or upgrade CocoaPods on your Mac:

```bash
# Using RubyGems (often needs sudo)
sudo gem install cocoapods

# Or using Homebrew (no sudo, recommended)
brew install cocoapods
```

Check the version (should be 1.15.2 or higher):

```bash
pod --version
```

You only need CocoaPods when building or running the iOS app locally (e.g. `npx expo run:ios` or EAS local builds). Cloud builds (EAS Build) use their own environment.
