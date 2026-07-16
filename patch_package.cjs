const fs = require('fs');
let code = JSON.parse(fs.readFileSync('package.json', 'utf8'));

code.scripts.dev = "tsx server.ts";
code.scripts.build = "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs";
code.scripts.start = "node dist/server.cjs";

fs.writeFileSync('package.json', JSON.stringify(code, null, 2));
console.log("Patched package.json");
