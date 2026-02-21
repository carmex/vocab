#!/bin/bash

# Exit on any error
set -e

echo "Starting deployment process..."

# 0. Ensure dependencies are installed
echo "Ensuring dependencies are installed..."
npm install --legacy-peer-deps --no-audit --no-fund --silent

# 0.1 Ensure environment file exists with correct production values
if [ ! -f "src/environments/environment.ts" ]; then
    echo "src/environments/environment.ts not found."
    
    # Use environment variables if available, otherwise prompt
    SUPABASE_URL=${SUPABASE_URL:-""}
    SUPABASE_KEY=${SUPABASE_KEY:-""}
    
    if [ -z "$SUPABASE_URL" ]; then
        read -p "Enter Supabase URL (e.g., https://api.crmx.pw): " SUPABASE_URL
    fi
    if [ -z "$SUPABASE_KEY" ]; then
        read -p "Enter Supabase Anon Key: " SUPABASE_KEY
    fi

    echo "Creating src/environments/environment.ts..."
    cat > src/environments/environment.ts <<EOF
export const environment = {
    production: true,
    supabase: {
        url: '$SUPABASE_URL',
        key: '$SUPABASE_KEY'
    }
};
EOF
fi

# 1. Build the Angular application
echo "Building Angular application..."
npm run build

# 2. Update Supabase functions
# Since we are using a self-hosted instance in /opt/supabase, 
# we deploy by copying function files into the Docker volume and restarting the container.
echo "Updating Supabase functions in self-hosted directory..."

TARGET_FUNCTIONS_DIR="/opt/supabase/docker/volumes/functions"
FUNCTIONS=("generate-audio" "generate-sentences" "image-to-vocab" "process-audio-queue")

for func in "${FUNCTIONS[@]}"; do
    if [ -d "supabase/functions/$func" ]; then
        echo "Updating function: $func"
        sudo cp -r "supabase/functions/$func"/* "$TARGET_FUNCTIONS_DIR/$func/"
    else
        echo "Warning: Function directory supabase/functions/$func not found in project."
    fi
done

echo "Restarting Supabase edge functions container..."
docker restart supabase-edge-functions

# 3. Copy dist artifacts to web directory
WEB_DIR="/var/www/html/vocab.crmx.pw"
echo "Deploying build artifacts to $WEB_DIR..."

# Check if the target directory exists, if not create it
if [ ! -d "$WEB_DIR" ]; then
    echo "Creating target directory: $WEB_DIR"
    sudo mkdir -p "$WEB_DIR"
    sudo chown carmex:www-data "$WEB_DIR"
fi

# Detect build output directory
# Angular 19 application builder typically outputs to dist/vocab/browser
if [ -d "dist/vocab/browser" ]; then
    SOURCE_DIR="dist/vocab/browser"
elif [ -d "dist/browser" ]; then
    SOURCE_DIR="dist/browser"
elif [ -d "dist/vocab" ] && [ -f "dist/vocab/index.html" ]; then
    SOURCE_DIR="dist/vocab"
else
    echo "Error: Build output directory not found. Please check 'dist' folder structure."
    ls -R dist/ || echo "dist folder is empty"
    exit 1
fi

# Remove old content and copy new content
# Using sudo as /var/www/html typically requires elevated permissions
echo "Cleaning $WEB_DIR and copying new files..."
sudo rm -rf "$WEB_DIR"/*
sudo cp -r "$SOURCE_DIR"/* "$WEB_DIR"/

echo "Deployment successful!"
