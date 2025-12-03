#!/bin/bash
set -e

# Pull latest changes
git pull --rebase

# Run bumpp (non-interactive)
bumpp --no-push --yes

# Get the new version
VERSION=$(node -p "require('./package.json').version")

# Generate changelog
bunx conventional-changelog -p angular -i CHANGELOG.md -s -r 0

# Stage files
git add CHANGELOG.md package.json

# Create commit
git commit -m "chore: release v$VERSION"

# Create tag (force update if exists)
git tag -f "v$VERSION" || git tag "v$VERSION"

# Push everything
git push --follow-tags

