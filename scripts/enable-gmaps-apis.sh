#!/usr/bin/env bash
# Enable all Google Maps APIs needed by Digi Mess (project: Khana-any-where-user)
# Usage: ./scripts/enable-gmaps-apis.sh [PROJECT_ID]
set -euo pipefail

PROJECT_ID="${1:-Khana-any-where-user}"

APIS=(
  maps-backend.googleapis.com          # Maps JavaScript API (admin interactive map)
  places.googleapis.com              # Places API (New) — admin search
  static-maps-backend.googleapis.com   # Maps Static API — mobile web map tiles
  maps-embed-backend.googleapis.com    # Maps Embed API (optional)
  maps-android-backend.googleapis.com  # Maps SDK for Android — native APK
  routes.googleapis.com              # Routes API — backend directions proxy
  directions-backend.googleapis.com  # Directions API — web browser fallback
)

echo "Enabling Maps APIs on project: ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}"

for api in "${APIS[@]}"; do
  echo "→ ${api}"
  gcloud services enable "${api}" --project="${PROJECT_ID}"
done

echo ""
echo "Done. Also verify in console:"
echo "  https://console.cloud.google.com/apis/library?project=${PROJECT_ID}"
echo "  Billing must be enabled: https://console.cloud.google.com/billing"
