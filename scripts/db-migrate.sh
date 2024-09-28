#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Check if TypeORM CLI is installed
if ! command -v typeorm &> /dev/null; then
  echo "TypeORM CLI is not installed. Installing..."
  npm install -g typeorm
fi

# Run migrations
echo "Running database migrations..."
typeorm migration:run

# Check if migrations were successful
if [ $? -eq 0 ]; then
  echo "Migrations completed successfully."
else
  echo "Error occurred while running migrations."
  exit 1