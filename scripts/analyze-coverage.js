const fs = require('fs');
const path = require('path');

const coveragePath = path.join(__dirname, '../coverage/coverage-final.json');

if (!fs.existsSync(coveragePath)) {
    console.error('Coverage file not found:', coveragePath);
    process.exit(1);
}

const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));

const results = [];

for (const filePath in coverage) {
    const fileCov = coverage[filePath];
    const { s, f, b } = fileCov;

    const totalStmts = Object.keys(s).length;
    const coveredStmts = Object.values(s).filter(v => v > 0).length;
    const stmtPct = totalStmts === 0 ? 100 : (coveredStmts / totalStmts) * 100;

    results.push({
        file: path.relative(path.join(__dirname, '..'), filePath),
        stmtPct,
        totalStmts,
        coveredStmts
    });
}

// Sort by percentage ascending
results.sort((a, b) => a.stmtPct - b.stmtPct);

console.log('Bottom 10 files by statement coverage:');
results.slice(0, 10).forEach(r => {
    console.log(`${r.stmtPct.toFixed(2)}% (${r.coveredStmts}/${r.totalStmts}) - ${r.file}`);
});
