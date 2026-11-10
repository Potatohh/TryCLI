import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const cli = fileURLToPath(new URL('./build.mjs', import.meta.url));
const input = "İstanbul & <city>\n";
const recipe = {tool:'Example', description:'Example demo', input, examples:[
  {label:'Echo', args:[process.execPath, '-e', "process.stdin.pipe(process.stdout)"], output:input}
]};
function fixture(t, content = recipe) {
  const dir = mkdtempSync(join(tmpdir(), 'trycli-test-'));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  const source = join(dir,'source.json');
  const out = join(dir,'demo.html');
  writeFileSync(source, JSON.stringify(content));
  function run(...flags) {
    return spawnSync(process.execPath, [cli,...flags,source,out], {encoding:'utf8'});
  }
  function data() {
    return JSON.parse(readFileSync(out,'utf8').match(/id="data">(.*?)<\/script>/s)[1]);
  }
  return {run,out,data,source};
}
test('recording preserves UTF-8 input and actual stdout', t => {
  const f = fixture(t);
  assert.equal(f.run('--record').status,0);
  assert.equal(f.data().examples[0].output,input);
});
test('offline build embeds literal text and empty output without executing commands', t => {
  const text = 'İstanbul </script> & $&';
  const f = fixture(t,{...recipe,input:text,examples:[{label:text,args:['missing-program'],output:''}]});
  assert.equal(f.run().status,0);
  assert.equal(f.data().input,text);
  assert.equal(f.data().examples[0].output,'');
});
test('existing output requires explicit overwrite', t => {
  const f = fixture(t);
  writeFileSync(f.out,'original');
  assert.notEqual(f.run().status,0);
  assert.equal(readFileSync(f.out,'utf8'),'original');
  assert.equal(f.run('--force').status,0);
  assert.equal(f.data().tool,'Example');
});
test('failure late in recording preserves previous demo', t => {
  const f = fixture(t,{...recipe,examples:[...recipe.examples,{label:'Fails',args:[process.execPath,'-e','process.exit(3)']}]});
  writeFileSync(f.out,'original');
  assert.notEqual(f.run('--force','--record').status,0);
  assert.equal(readFileSync(f.out,'utf8'),'original');
});
for (const [label, broken] of Object.entries({empty:{...recipe,examples:[]},invalid:{...recipe,examples:[null]},incomplete:{...recipe,examples:[{label:'Example',args:['unknown']}]}})) {
  test('rejects '+label+' recipe', t => {
    const f=fixture(t,broken);
    assert.notEqual(f.run().status,0);
    assert.equal(existsSync(f.out),false);
  });
}
