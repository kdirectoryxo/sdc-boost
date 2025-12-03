#!/bin/bash
set -e

git pull --rebase
bumpp --major --no-push --yes
VERSION=$(node -p "require('./package.json').version")
bunx conventional-changelog -p angular -i CHANGELOG.md -s -r 0
git add CHANGELOG.md package.json
git commit -m "chore: release v$VERSION"
git tag -f "v$VERSION" || git tag "v$VERSION"
git push --follow-tags

