const app = require('./app');
const config = require('./config/env');
const { pool } = require('./config/db');

const PORT = config.PORT;

const startServer = async () => {
  try {
    const client = await pool.connect();
    console.log(`Connected to database "${config.DB.database}" on port ${config.DB.port}`);
    client.release();

    const server = app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });

    const shutdown = async () => {
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
