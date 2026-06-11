#!/bin/sh
# Xcode Cloud: install JS deps + CocoaPods before building the Capacitor app.
set -e
export HOMEBREW_NO_INSTALL_CLEANUP=1
brew install node cocoapods 2>/dev/null || true
cd "$CI_PRIMARY_REPOSITORY_PATH/mobile"
npm ci --no-audit --no-fund || npm install --no-audit --no-fund
npx cap sync ios
