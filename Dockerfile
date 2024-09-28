# Use an official Node runtime as a parent image
FROM node:16

# Set the working directory in the container
WORKDIR /usr/src/app

# Install pnpm
RUN npm install -g pnpm

# Copy package.json and pnpm-lock.yaml (if available)
COPY package.json pnpm-lock.yaml* ./

# Install project dependencies
RUN pnpm install

# Copy project files and folders to the current working directory (i.e. 'app' folder)
COPY . .

# Build the app
RUN pnpm run build

# Expose port 3000
EXPOSE 3000

# Start the server using production build
CMD [ "pnpm", "run", "start:prod" ]