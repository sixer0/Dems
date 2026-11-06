// Read-only probe: list nodes whose install scripts npm would enumerate, with the tree loaded
// (a) the way `npm install-scripts ls` loads it (hidden lockfile allowed), and
// (b) with forceActual (a scan of the disk, hidden lockfile ignored).
const R = '/usr/local/lib/node_modules/npm/node_modules/';
const Arborist = require(R + '@npmcli/arborist');
const { getInstallScripts } = require(R + '@npmcli/arborist/lib/install-scripts.js');
(async () => {
  for (const [label, opts] of [['default (hidden lockfile allowed)', {}], ['forceActual (disk scan)', { forceActual: true }]]) {
    const arb = new Arborist({ path: process.cwd() });
    const tree = await arb.loadActual(opts);
    const rows = [];
    for (const node of tree.inventory.values()) {
      if (node.isRoot || node.isLink || node.isWorkspace) continue;
      const c = await getInstallScripts(node);
      if (Object.keys(c).length) rows.push(`${node.name}@${node.version} ${JSON.stringify(c)} hasInstallScript=${node.hasInstallScript}`);
    }
    rows.sort();
    console.log(`== ${label}: ${rows.length} nodes with enumerable install scripts`);
    for (const r of rows) console.log('   ' + r);
  }
})().catch((e) => { console.error('PROBE FAILED', e.message); process.exit(1); });
