const path = require('path')
const fs = require('fs')

// Load .env from project root
const envPath = path.resolve(__dirname, '.env')
const env = {}
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .forEach((line) => {
      const idx = line.indexOf('=')
      if (idx > 0) {
        const key = line.slice(0, idx).trim()
        const val = line.slice(idx + 1).trim()
        env[key] = val
      }
    })
}

module.exports = {
  apps: [
    {
      name: 'bout-api',
      cwd: './apps/api',
      script: 'dist/index.js',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        ...env,
      },
    },
    {
      name: 'bout-judge',
      cwd: './apps/judge',
      script: 'dist/worker.js',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        ...env,
      },
    },
    {
      name: 'bout-web',
      cwd: './apps/web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      env: {
        NODE_ENV: 'production',
        ...env,
      },
    },
  ],
}
