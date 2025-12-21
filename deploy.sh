#!/bin/bash

# Deploy script for GT AKPsi Rush App
# Frontend: Vercel (automatic via git push, or manual build)
# Backend: Railway (automatic via git push)

# List of commands
frontend_commands=(
    "cd client"
    "npm run build"
    "echo 'Frontend built! Deploy to Vercel via git push or Vercel CLI'"
    "cd ../"
)

backend_commands=(
    "cd server"
    "cargo build --release"
    "echo 'Backend built! Deploy to Railway via git push'"
    "cd ../"
)

# Function to run commands
run_commands() {
    local commands=("$@")
    for cmd in "${commands[@]}"
    do
        echo "Executing: $cmd"
        eval $cmd
    done
}

# Check for arguments
if [[ $1 == "--frontend" ]]; then
    echo "Running frontend commands..."
    run_commands "${frontend_commands[@]}"
elif [[ $1 == "--backend" ]]; then
    echo "Running backend commands..."
    run_commands "${backend_commands[@]}"
else
    run_commands "${frontend_commands[@]}"
    run_commands "${backend_commands[@]}"
fi

echo ""
echo "============================================"
echo "Deployment builds complete!"
echo ""
echo "To deploy:"
echo "  - Frontend: Push to GitHub (Vercel auto-deploys)"
echo "  - Backend: Push to GitHub (Railway auto-deploys)"
echo "============================================"
