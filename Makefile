# Aether Backend Makefile

# Variables
SHELL := /bin/bash
PNPM := pnpm
DOCKER := docker
DOCKER_COMPOSE := docker-compose
SONAR_SCANNER := sonar-scanner

# Application
APP_NAME := aether-backend
NODE_ENV ?= development

# Docker
DOCKER_IMAGE_NAME := aether-backend
DOCKER_IMAGE_TAG ?= latest

# Paths
SRC_DIR := src
DIST_DIR := dist
TEST_DIR := test

# Commands
.PHONY: help install dev build start test lint format clean docker-build docker-run docker-push k8s-deploy sonar

# Help command
help:
	@echo "Aether Backend Makefile (pnpm version)"
	@echo "Usage: make [command]"
	@echo ""
	@echo "Available commands:"
	@echo "  help              Show this help message"
	@echo "  install           Install project dependencies"
	@echo "  dev               Start the development server"
	@echo "  build             Build the project for production"
	@echo "  start             Start the production server"
	@echo "  test              Run all tests"
	@echo "  test:e2e          Run end-to-end tests"
	@echo "  test:cov          Run tests with coverage"
	@echo "  lint              Run linter"
	@echo "  format            Format code"
	@echo "  clean             Remove build artifacts"
	@echo "  docker-build      Build Docker image"
	@echo "  docker-run        Run Docker container"
	@echo "  docker-push       Push Docker image to registry"
	@echo "  k8s-deploy        Deploy to Kubernetes"
	@echo "  sonar             Run SonarQube analysis"

# Installation
install:
	@echo "Installing dependencies..."
	@if [ -f pnpm-lock.yaml ]; then \
		echo "Found pnpm-lock.yaml, attempting to use pnpm install --frozen-lockfile..."; \
		$(PNPM) install --frozen-lockfile || \
		(echo "Frozen install failed. Updating lockfile and installing dependencies..." && \
		$(PNPM) install); \
	else \
		echo "No pnpm-lock.yaml found, using pnpm install..."; \
		$(PNPM) install; \
	fi

# Development
dev:
	@echo "Installing dependencies..."
	@$(MAKE) install
	@echo "Building the project..."
	@$(PNPM) run build
	@echo "Starting development server..."
	@$(PNPM) run start:dev

# Build
build:
	@echo "Building for production..."
	@$(PNPM) run build

# Start production
start:
	@echo "Starting production server..."
	@$(PNPM) run start:prod

# Testing
test:
	@echo "Running all tests..."
	@$(PNPM) test

test\:e2e:
	@echo "Running end-to-end tests..."
	@$(PNPM) run test:e2e

test\:cov:
	@echo "Running tests with coverage..."
	@$(PNPM) run test:cov

# Linting and formatting
lint:
	@echo "Linting code..."
	@$(PNPM) run lint

format:
	@echo "Formatting code..."
	@$(PNPM) run format

# Cleaning
clean:
	@echo "Cleaning build artifacts..."
	@$(PNPM) run prebuild

# Docker operations
docker-build:
	@echo "Building Docker image..."
	@$(DOCKER) build -t $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG) .

docker-run:
	@echo "Running Docker container..."
	@$(DOCKER) run -p 3000:3000 $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG)

docker-push:
	@echo "Pushing Docker image to registry..."
	@$(DOCKER) push $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG)

# Kubernetes deployment
k8s-deploy:
	@echo "Deploying to Kubernetes..."
	@kubectl apply -f k8s/

# SonarQube analysis
sonar:
	@echo "Running SonarQube analysis..."
	@$(SONAR_SCANNER) \
		-Dsonar.projectKey=osvalois_aether-backend \
		-Dsonar.organization=osvalois \
		-Dsonar.sources=. \
		-Dsonar.host.url=https://sonarcloud.io

# Default target
.DEFAULT_GOAL := help