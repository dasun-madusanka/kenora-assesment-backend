const express = require('express');
const cors = require('cors');
const { errorHandler, ApiError } = require('./middleware/errorHandler');

const app = express();

// Enable Cross-Origin Resource Sharing
app.use(cors({
  origin: '*', // Adjust or restrict in production
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Liveness / Readiness Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Workshop Registration API',
    timestamp: new Date().toISOString(),
  });
});

// Root API welcome
app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the Workshop Registration Service API',
    version: '1.0.0',
    documentation: '/api/docs',
  });
});

// Modular Routes
app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/users', require('./modules/users/users.routes'));

// Fallback for undefined routes
app.use((req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
