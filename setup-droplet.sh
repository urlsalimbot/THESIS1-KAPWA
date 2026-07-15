#!/bin/bash
# ============================================================
# Kapwa — Fresh DigitalOcean Droplet Setup (run once)
# ============================================================
# Run this on a brand new Ubuntu 24.04 droplet as root or with sudo.
# ============================================================
set -euo pipefail

REPO_URL="${1:-git@github.com:your-org/kapwa.git}"
BRANCH="${2:-main}"

echo "=== Kapwa — Droplet Setup ==="

# 1. System packages
apt-get update
apt-get install -y docker.io docker-compose-v2 git curl

# 2. Enable Docker for non-root user (skip if running as root)
if [ -n "${SUDO_USER:-}" ]; then
    usermod -aG docker "$SUDO_USER"
fi

# 3. Clone repo
cd /opt
git clone --branch "$BRANCH" "$REPO_URL" kapwa
cd kapwa

# 4. Prompt to create env file
if [ ! -f infra/.env.production ]; then
    cp infra/.env.production.example infra/.env.production
    echo ""
    echo "========================================================"
    echo " EDIT infra/.env.production with real secrets, then run:"
    echo "   ./deploy.sh"
    echo "========================================================"
fi

echo "Setup complete. Edit infra/.env.production and run ./deploy.sh"
