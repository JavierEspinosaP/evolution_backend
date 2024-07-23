module.exports = {
  apps: [
    {
      name: 'evolution_backend',
      script: 'server.js',
      instances: 1, // Cambia esto para ejecutar múltiples instancias
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
