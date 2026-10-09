const app = require('./app');
const config = require('./config/env');
const { pool } = require('./config/db');

const PORT = config.PORT;

// Verify database connection before starting HTTP server
const startServer = async () => {
  try {
    const client = await pool.connect();
    console.log(`[Database] Connected successfully to PostgreSQL database: "${config.DB.database}" on ${config.DB.host}:${config.DB.port}`);
    client.release();

    const server = app.listen(PORT, () => {
      console.log(`[Server] Workshop Registration Service running on port ${PORT} (${config.NODE_ENV})`);
      console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Closing server gracefully...`);
      server.close(async () => {
        console.log('[Server] HTTP server closed.');
        try {
          await pool.end();
          console.log('[Database] PostgreSQL connection pool closed.');
          process.exit(0);
        } catch (err) {
          console.error('[Database] Error closing pool:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    console.error('[Database] Failed to connect to PostgreSQL:', error.message);
    process.exit(1);
  }
};

startServer();
