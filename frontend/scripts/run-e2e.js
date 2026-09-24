import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cypressCli = resolve(frontendDir, 'node_modules/cypress/bin/cypress');

const server = await createServer({
  mode: 'e2e',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});

let exitCode = 0;

try {
  await server.listen();
  const code = await new Promise((resolveCode, reject) => {
    const cypress = spawn(process.execPath, [cypressCli, 'run', ...process.argv.slice(2)], {
      cwd: frontendDir,
      env: process.env,
      stdio: 'inherit',
    });
    cypress.once('error', reject);
    cypress.once('exit', status => resolveCode(status ?? 1));
  });
  exitCode = code;
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await server.close();
}

process.exitCode = exitCode;
