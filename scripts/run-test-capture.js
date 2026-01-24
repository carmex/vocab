const { spawn } = require('child_process');
const fs = require('fs');

const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = ['test', 'src/app/services/state.service.spec.ts', '--', '--verbose'];

console.log('Running:', cmd, args.join(' '));

const child = spawn(cmd, args, { shell: true });
const stream = fs.createWriteStream('test-output.txt');

child.stdout.pipe(stream);
child.stderr.pipe(stream);

child.on('exit', (code) => {
    console.log('Child exit code:', code);
});
