#!/usr/bin/env bash
# Render build for the VETO API.
#
# uv is the project's package manager (CLAUDE.md §2), so uv.lock stays the one
# source of dependency truth. Exporting a requirements.txt alongside it would be
# a second file to keep in sync, and this repo has already been bitten twice by
# two copies of the same fact drifting apart.
#
# Run from backend/ — Render's rootDir handles that.

set -o errexit
set -o nounset
set -o pipefail

pip install --upgrade uv

# --frozen fails rather than silently resolving something the lock did not
# describe, so a deploy can never quietly ship different versions than local.
uv sync --frozen

# Django admin needs its static files; CompressedManifestStaticFilesStorage
# raises on a missing manifest, so this is not optional even for an API.
uv run python manage.py collectstatic --no-input

uv run python manage.py migrate --no-input
