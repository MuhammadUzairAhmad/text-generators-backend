module.exports = {
  apps: [
    {
      name: 'text-generators-backend',
      script: 'dist/main.js',
      instances: 'max', // Automatically clusters across all available CPU cores (e.g. 2 cores on Oracle Cloud)
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 4000,
      },
    },
  ],
};
