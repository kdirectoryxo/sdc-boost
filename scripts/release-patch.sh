#!/bin/bash
set -e

if [ -z "$(git diff --name-only | grep -v '^package.json$\|^package-lock.json$')" ]; then
  git restore package.json package-lock.json 2>/dev/null || true
fi
git pull --rebase
bumpp --patch --no-push --yes
VERSION=$(node -p "require('./package.json').version")
bunx conventional-changelog -p angular -i CHANGELOG.md -s -r 0
git add CHANGELOG.md package.json
git commit -m "chore: release v$VERSION"
git tag -f "v$VERSION" || git tag "v$VERSION"
git push --follow-tags

