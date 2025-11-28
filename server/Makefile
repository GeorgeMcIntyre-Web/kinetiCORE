# kinetiCORE FEA Backend Development Commands
#
# Quick reference for common development tasks

.PHONY: help install dev-api dev-worker test lint format type-check clean

help: ## Show this help message
	@echo "kinetiCORE FEA Backend - Development Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	pip install -r requirements-fea.txt

dev-api: ## Start FastAPI development server (port 8050)
	uvicorn app.main:app --reload --port 8050

dev-worker: ## Start Celery worker with live reload
	celery -A app.core.celery_app worker --loglevel=info

test: ## Run pytest tests
	pytest tests/ -v

test-cov: ## Run tests with coverage report
	pytest tests/ -v --cov=app --cov-report=html --cov-report=term

lint: ## Run linter (black check + isort check)
	black --check app/ tests/
	isort --check-only app/ tests/

format: ## Format code (black + isort)
	black app/ tests/
	isort app/ tests/

type-check: ## Run mypy type checker
	mypy app/

clean: ## Remove generated files and caches
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name '*.pyc' -delete
	find . -type f -name '*.pyo' -delete
	find . -type d -name '*.egg-info' -exec rm -rf {} +
	rm -rf .pytest_cache
	rm -rf .mypy_cache
	rm -rf htmlcov
	rm -rf .coverage

check: lint type-check test ## Run all checks (lint, type-check, test)
