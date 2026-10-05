const R = '/usr/local/lib/node_modules/npm/node_modules/';
const Arborist = require(R + '@npmcli/arborist');
const { getInstallScripts } = require(R + '@npmcli/arborist/lib/install-scripts.js');
(async () => {
  for (const [label, opts] of [['default', {}], ['forceActual', { forceActual: true }]]) {
    const arb = new Arborist({ path: process.cwd() });
    const tree = await arb.loadActual(opts);
    const n = tree.children.get('fsevents');
    console.log(label.padEnd(12), 'node found:', !!n, '| hasInstallScript:', n && n.hasInstallScript, '| package.scripts keys:', n && Object.keys((n.package || {}).scripts || {}).join(',') || '(none)', '| enumerated:', JSON.stringify(n ? await getInstallScripts(n) : null));
  }
})();
