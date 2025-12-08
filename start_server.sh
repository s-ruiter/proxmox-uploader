#!/bin/bash

# Navigate to the script's directory to ensure we run from the project root
cd "$(dirname "$0")"

echo "Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "Dependencies found."
fi

echo "Starting Proxmox Control Webserver..."
echo "Access the dashboard at http://localhost:3000"

# Run the development server
npm run dev
