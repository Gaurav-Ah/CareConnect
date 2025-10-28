#!/bin/bash

echo "🚀 Starting CareConnect Backend Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create database directory if it doesn't exist
mkdir -p database

# Check if database exists, if not run seed
if [ ! -f "database/careconnect.db" ]; then
    echo "🌱 Database not found. Running seed script..."
    npm run seed
fi

# Start the server
echo "🎉 Starting server on port 3001..."
npm start