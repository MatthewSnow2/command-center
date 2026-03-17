module.exports = {
  apps: [{
    name: 'command-center',
    script: 'dist/server/server/index.js',
    cwd: __dirname,
    node_args: '--experimental-specifier-resolution=node',
    env: {
      NODE_ENV: 'production',
      COMMAND_CENTER_PORT: '3142',
    },
    exp_backoff_restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s',
  }],
};
