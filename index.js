const { spawn } = require('child_process');
const path = require('path');

spawn(
  path.join(__dirname, 'node_modules', '.bin', 'tsx'),
  [path.join(__dirname, 'app.ts')],
  {
    stdio: 'inherit',
    shell: true,
  }
).on('exit', (code) => {
  process.exit(code ?? 1);
});
