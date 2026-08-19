#!/bin/bash
#
# Rebuild the web bundle and copy it into the app, on every Xcode build.
#
# **Why this exists.** Xcode compiles `ios/App/App/public/`, and the only thing
# that refreshes it is `npx cap copy ios` — Run does not. So pressing Run after
# a web change faithfully rebuilds the *last copied* bundle, with no error
# anywhere: the phone shows stale UI and every signal says the build succeeded.
# It cost three rounds of device testing in one session, twice producing "the
# fix didn't work" reports against code that predated the fix, and it kept
# happening because the copy was a separate command you had to remember.
#
# `npm run ios` is that pair as one command and it works, but it is still a
# thing to remember, and Run in Xcode bypasses it entirely. Here it can't be
# skipped — the bundle Xcode packages is built moments earlier in the same
# build.
#
# It fails loudly rather than continuing. A missing toolchain that let the
# build carry on would reintroduce exactly the silent staleness this prevents.
set -euo pipefail

# $SRCROOT is ios/App; the repo root is two levels up.
cd "$SRCROOT/../.."

# Xcode's PATH has no node. nvm is a shell function, so it has to be sourced.
# The Capacitor CLI needs Node >= 22 while the repo default is 20.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "error: nvm not found at $NVM_DIR — cannot build the web bundle, and a" >&2
  echo "error: build without it would silently ship the last copied one." >&2
  exit 1
fi
# shellcheck disable=SC1091
\. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null

npm run build
npx cap copy ios
