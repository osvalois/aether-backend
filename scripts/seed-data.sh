#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "Node.js is not installed. Please install Node.js and try again."
  exit 1
fi

# Run the seeder script
echo "Running data seeder..."
node dist/database/seeders/index.js

# Check if seeding was successful
if [ $? -eq 0 ]; then
  echo "Data seeding completed successfully."
else
  echo "Error occurred while seeding data."
  exit 1
fi