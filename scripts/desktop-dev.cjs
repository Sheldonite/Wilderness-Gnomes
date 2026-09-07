// Launch the Electron shell against the running Vite dev server (npm run dev on port 5187).
process.env.WILDERNESS_DEV_URL = process.env.WILDERNESS_DEV_URL || 'http://127.0.0.1:5187';
require('child_process').spawn(require('electron'), ['.'], { stdio: 'inherit', env: process.env });
