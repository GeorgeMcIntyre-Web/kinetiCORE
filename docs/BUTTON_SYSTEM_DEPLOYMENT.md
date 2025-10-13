# Button System Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the complete frontend and backend button system for kinetiCORE.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Git for version control
- Docker (optional, for containerized deployment)

## Frontend Deployment

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install additional dependencies for button system
npm install @types/ws ws
```

### 2. Environment Configuration

Create `.env.local` file:

```env
# Frontend Environment Variables
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_NODE_ENV=development
```

### 3. Build Frontend

```bash
# Development build
npm run dev

# Production build
npm run build
```

### 4. Frontend Integration

Add to your main App component:

```typescript
// src/App.tsx
import React from 'react';
import { ButtonSystemInitializer } from './ui/components/ButtonSystemInitializer';
import { SnapControls } from './ui/components/SnapControls';

export function App() {
  return (
    <div className="app">
      <ButtonSystemInitializer />
      <SnapControls />
      {/* Rest of your app */}
    </div>
  );
}
```

## Backend Deployment

### 1. Create Backend Directory

```bash
mkdir backend
cd backend
npm init -y
```

### 2. Install Backend Dependencies

```bash
# Install backend dependencies
npm install express cors helmet ws uuid joi
npm install -D @types/express @types/cors @types/ws @types/uuid @types/node typescript ts-node-dev jest @types/jest
```

### 3. Backend Package Configuration

**File**: `backend/package.json`

```json
{
  "name": "kineticore-backend",
  "version": "1.0.0",
  "description": "kinetiCORE Backend API",
  "main": "dist/app.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "ws": "^8.13.0",
    "uuid": "^9.0.0",
    "joi": "^17.9.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/ws": "^8.5.5",
    "@types/uuid": "^9.0.2",
    "@types/node": "^20.4.5",
    "typescript": "^5.1.6",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.6.1",
    "@types/jest": "^29.5.3"
  }
}
```

### 4. Backend TypeScript Configuration

**File**: `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 5. Backend Environment Configuration

**File**: `backend/.env`

```env
# Backend Environment Variables
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000
```

### 6. Complete Backend Implementation

**File**: `backend/src/app.ts`

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketService } from './services/WebSocketService';
import { ButtonService } from './services/ButtonService';
import { ButtonController } from './controllers/ButtonController';

const app = express();
const server = createServer(app);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Initialize services
const wsService = new WebSocketService(server);
const buttonService = new ButtonService(wsService);
const buttonController = new ButtonController(buttonService);

// Routes
app.get('/api/buttons/:buttonId/state', buttonController.getButtonState);
app.post('/api/buttons/:buttonId/state', buttonController.setButtonState);
app.post('/api/buttons/:buttonId/action', buttonController.executeButtonAction);
app.get('/api/buttons/states', buttonController.getAllButtonStates);
app.get('/api/buttons/actions', buttonController.getAllButtonActions);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    buttonStates: buttonService.getAllButtonStates().length,
    connectedClients: wsService.getConnectedClientsCount()
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[App] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`[App] Server running on port ${PORT}`);
  console.log(`[App] WebSocket endpoint: ws://localhost:${PORT}/ws/buttons`);
  console.log(`[App] Health check: http://localhost:${PORT}/health`);
});

export default app;
```

### 7. Start Backend

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## Testing

### 1. Frontend Tests

```bash
# Run frontend tests
npm test

# Run specific button tests
npm test -- ButtonSystem.test.tsx
npm test -- ButtonIntegration.test.tsx
```

### 2. Backend Tests

```bash
# Run backend tests
cd backend
npm test
```

### 3. Integration Tests

```bash
# Start backend
cd backend
npm run dev

# In another terminal, start frontend
npm run dev

# Test the integration
curl http://localhost:3001/health
```

## Docker Deployment

### 1. Frontend Dockerfile

**File**: `Dockerfile`

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 2. Backend Dockerfile

**File**: `backend/Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "start"]
```

### 3. Docker Compose

**File**: `docker-compose.yml`

```yaml
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - "3000:80"
    environment:
      - VITE_API_URL=http://backend:3001
      - VITE_WS_URL=ws://backend:3001
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - CORS_ORIGIN=http://localhost:3000
```

### 4. Deploy with Docker

```bash
# Build and start services
docker-compose up --build

# Run in background
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Production Deployment

### 1. Environment Variables

**Production `.env`:**

```env
# Frontend
VITE_API_URL=https://api.kineticore.com
VITE_WS_URL=wss://api.kineticore.com
VITE_NODE_ENV=production

# Backend
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://kineticore.com
LOG_LEVEL=warn
```

### 2. Production Build

```bash
# Frontend
npm run build

# Backend
cd backend
npm run build
```

### 3. Process Management

Use PM2 for production process management:

```bash
# Install PM2
npm install -g pm2

# Start backend
cd backend
pm2 start dist/app.js --name "kineticore-backend"

# Start frontend (if using Node.js server)
pm2 start dist/server.js --name "kineticore-frontend"

# Save PM2 configuration
pm2 save
pm2 startup
```

## Monitoring & Maintenance

### 1. Health Checks

```bash
# Check backend health
curl http://localhost:3001/health

# Check frontend
curl http://localhost:3000
```

### 2. Log Monitoring

```bash
# View backend logs
pm2 logs kineticore-backend

# View frontend logs
pm2 logs kineticore-frontend
```

### 3. Performance Monitoring

```bash
# Monitor PM2 processes
pm2 monit

# View process status
pm2 status
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check firewall settings
   - Verify WebSocket URL configuration
   - Check backend WebSocket service

2. **CORS Errors**
   - Verify CORS_ORIGIN configuration
   - Check frontend URL matches backend CORS settings

3. **Button States Not Syncing**
   - Check WebSocket connection status
   - Verify button service initialization
   - Check console for error messages

4. **Backend Not Starting**
   - Check port availability
   - Verify environment variables
   - Check TypeScript compilation

### Debug Commands

```bash
# Check WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" http://localhost:3001/ws/buttons

# Test button API
curl -X POST http://localhost:3001/api/buttons/test/state -H "Content-Type: application/json" -d '{"value": true}'

# Check button states
curl http://localhost:3001/api/buttons/states
```

## Security Considerations

1. **HTTPS/WSS in Production**: Use secure connections
2. **CORS Configuration**: Restrict origins appropriately
3. **Rate Limiting**: Implement API rate limiting
4. **Input Validation**: Validate all button inputs
5. **Authentication**: Add user authentication if needed

## Scaling Considerations

1. **Load Balancing**: Use multiple backend instances
2. **Database**: Store button states in database for persistence
3. **Redis**: Use Redis for session management
4. **CDN**: Use CDN for frontend assets

This deployment guide ensures a robust, scalable button system that works reliably in both development and production environments.
