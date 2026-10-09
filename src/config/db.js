const { Pool } = require('pg');
const config = require('./env');

const poolConfig = config.DB.connectionString
  ? {
      connectionString: config.DB.connectionString,
      ssl: config.DB.ssl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: config.DB.host,
      port: config.DB.port,
      database: config.DB.database,
      user: config.DB.user,
      password: config.DB.password,
      ssl: config.DB.ssl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

module.exports = {
  pool,
  query,
  getClient,
};
