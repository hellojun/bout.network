module.exports = {
  apps: [
    {
      name: 'bout-api',
      cwd: './apps/api',
      script: 'dist/index.js',
      env: { NODE_ENV: 'production', PORT: 3000 }
    },
    {
      name: 'bout-judge',
      cwd: './apps/judge',
      script: 'dist/worker.js',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'bout-web',
      cwd: './apps/web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      env: { NODE_ENV: 'production' }
    }
  ]
}