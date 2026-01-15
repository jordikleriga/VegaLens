import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import elasticRoutes from './routes/elastic.routes.js';
import vegaRoutes from './routes/vega.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import aggregationRoutes from './routes/aggregation.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger, logger } from './middleware/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - configure helmet for production SPA serving
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: null  // Disable auto-upgrade to HTTPS
    }
  } : false
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false  // Same-origin in production, no CORS needed
    : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger); // Custom request logging

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/elastic', elasticRoutes);
app.use('/api/vega', vegaRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/aggregations', aggregationRoutes);

// API error handling
app.use('/api', errorHandler);

// Serve static files in production (frontend build)
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, '..', 'public');

  // Serve static assets
  app.use(express.static(publicPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Fallback error handler for non-production
if (process.env.NODE_ENV !== 'production') {
  app.use(errorHandler);
}

app.listen(PORT, () => {
  console.log(`🚀 Vega Dashboard Builder API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;

