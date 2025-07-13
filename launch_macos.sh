#!/bin/bash

# macOS Storage Visualization Tool - Launch Script
# This script sets up and launches the storage visualization app on macOS

set -e  # Exit on any error

echo "🔍 macOS Storage Visualization Tool"
echo "=================================="
echo
echo "📋 SYSTEM ACCESS SETUP:"
echo "   For full system scanning (Applications, System, Root directories):"
echo "   1. Open System Preferences → Security & Privacy → Privacy"
echo "   2. Select 'Full Disk Access' from the left sidebar"
echo "   3. Click the lock icon and enter your password"
echo "   4. Click the '+' button and add your Terminal app"
echo "   5. Alternatively: Add Python interpreter at $(which python3)"
echo "   6. Restart Terminal after granting permissions"
echo
echo "   Without Full Disk Access, you can still scan:"
echo "   • User directories (Downloads, Documents, Desktop, etc.)"
echo "   • Applications folder (with limited access)"
echo "   • Some system directories that don't require special permissions"
echo

# Check if we're running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is designed for macOS systems only."
    echo "   Current OS: $OSTYPE"
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for Python 3
if command_exists python3; then
    PYTHON_CMD="python3"
    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
    echo "✅ Python 3 found: $PYTHON_VERSION"
elif command_exists python; then
    PYTHON_VERSION=$(python --version 2>&1 | cut -d' ' -f2)
    if [[ $PYTHON_VERSION == 3.* ]]; then
        PYTHON_CMD="python"
        echo "✅ Python 3 found: $PYTHON_VERSION"
    else
        echo "❌ Python 3 is required but not found."
        echo "   Please install Python 3 from https://python.org or use Homebrew:"
        echo "   brew install python3"
        exit 1
    fi
else
    echo "❌ Python 3 is required but not found."
    echo "   Please install Python 3 from https://python.org or use Homebrew:"
    echo "   brew install python3"
    exit 1
fi

# Check for pip
if command_exists pip3; then
    PIP_CMD="pip3"
    echo "✅ pip3 found"
elif command_exists pip; then
    PIP_CMD="pip"
    echo "✅ pip found"
else
    echo "❌ pip is required but not found."
    echo "   Please install pip or reinstall Python 3"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📁 App directory: $SCRIPT_DIR"

# Create virtual environment if it doesn't exist
VENV_DIR="$SCRIPT_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "🔧 Creating virtual environment..."
    $PYTHON_CMD -m venv "$VENV_DIR"
    echo "✅ Virtual environment created"
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Install required packages
echo "📦 Installing required packages..."
if [ -f "$SCRIPT_DIR/app_requirements.txt" ]; then
    $PIP_CMD install -r "$SCRIPT_DIR/app_requirements.txt"
else
    $PIP_CMD install flask
fi

# Verify all required files exist
REQUIRED_FILES=("app.py" "scanner.py" "templates/index.html" "static/style.css" "static/script.js")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$SCRIPT_DIR/$file" ]; then
        echo "❌ Required file missing: $file"
        exit 1
    fi
done
echo "✅ All required files found"



# Find an available port (start from 8080 to avoid macOS conflicts: 5000=AirPlay, 5001=System)
PORT=8080
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; do
    PORT=$((PORT + 1))
    # Prevent infinite loop, max port 8130
    if [ $PORT -gt 8130 ]; then
        echo "❌ Could not find available port between 8080-8130"
        echo "   Please stop other services or specify a different port"
        exit 1
    fi
done

echo
echo "🚀 Starting macOS Storage Visualization Tool..."
echo "   Port: $PORT"
echo "   App directory: $SCRIPT_DIR"
echo

# Set environment variables
export FLASK_APP="$SCRIPT_DIR/app.py"
export FLASK_ENV="development"

# Function to open browser after a delay
open_browser() {
    sleep 3
    if command_exists open; then
        echo "🌐 Opening browser..."
        open "http://localhost:$PORT"
    fi
}

# Open browser in background
open_browser &

echo "📖 Usage Instructions:"
echo "   • The app will open automatically in your browser"
echo "   • You can now scan ANY directory including:"
echo "     - User directories: $HOME/Desktop, $HOME/Documents"
echo "     - System directories: /Applications, /System, /"
echo "     - Full root filesystem scan: /"
echo "   • For best results with system directories, enable Full Disk Access (see above)"
echo "   • Press Ctrl+C to stop the server"
echo

# Start the Flask app
cd "$SCRIPT_DIR"
$PYTHON_CMD app.py --port=$PORT

# Cleanup function
cleanup() {
    echo
    echo "🛑 Shutting down..."
    echo "✅ Cleanup complete"
}

# Set up cleanup on script exit
trap cleanup EXIT