/**
 * Development launcher: starts the local persistence API (server.js)
 * and the Angular dev server (ng serve) together, so one command runs
 * the whole app. Used by `npm start`.
 */
import { spawn } from 'child_process';

const children = [];

function start(name, command, args) {
  const child = spawn(command, args, { stdio: 'inherit', shell: true });
  children.push(child);
  child.on('exit', code => {
    console.log(`[dev] ${name} exited with code ${code}`);
  });
  return child;
}

start('api', 'node', ['server.js']);
start('ng serve', 'npx', ['ng', 'serve']);

function shutdown() {
  for (const child of children) {
    try {
      child.kill();
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
