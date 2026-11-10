import {existsSync, linkSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseArgs} from 'node:util';

function main() {
  const {values, positionals} = parseArgs({
    allowPositionals: true,
    options: {record: {type: 'boolean'}, force: {type: 'boolean'}}
  });
  const [source, destination] = positionals;
  if (positionals.length !== 2 || !destination.endsWith('.html')) {
    throw Error('Usage: node build.mjs [--record] [--force] recipe.json demo.html');
  }
  if (!values.force && existsSync(destination)) throw Error('Destination already exists. Choose a new path or use --force.');
  const recipe = JSON.parse(readFileSync(source, 'utf8').replace(/^\uFEFF/, ''));
  if (!recipe || typeof recipe.tool !== 'string' || !recipe.tool.trim() ||
      typeof recipe.description !== 'string' || typeof recipe.input !== 'string' ||
      !Array.isArray(recipe.examples) || !recipe.examples.length) {
    throw Error('Expected tool, description, input and at least one example.');
  }
  const examples = recipe.examples.map((example, index) => {
    if (!example || typeof example !== 'object') throw Error('Invalid example at position ' + (index + 1));
    const {label, args} = example;
    if (typeof label !== 'string' || !label.trim() || !Array.isArray(args) ||
        !args.length || args.some(arg => typeof arg !== 'string') || !args[0]) {
      throw Error('Each example needs a label and command argument list.');
    }
    let output = example.output;
    if (values.record) {
      const run = spawnSync(args[0], args.slice(1), {
        input: recipe.input, encoding: 'utf8', timeout: 10000, windowsHide: true
      });
      if (run.error || run.status !== 0) throw Error(label + ': ' + (run.error?.message || run.stderr || 'command failed'));
      output = run.stdout;
    }
    if (typeof output !== 'string') throw Error(label + ': supply output or use --record for a trusted recipe.');
    return {label, args, output};
  });
  const data = JSON.stringify({tool: recipe.tool, description: recipe.description, input: recipe.input, examples}).replaceAll('<', '\\u003c');
  const template = readFileSync(new URL('viewer.html', import.meta.url), 'utf8');
  const staging = mkdtempSync(join(dirname(destination), '.trycli-'));
  const file = join(staging, 'demo.html');
  try {
    writeFileSync(file, template.replace('RECIPE_DATA', () => data));
    if (values.force) renameSync(file, destination);
    else linkSync(file, destination);
  } finally {
    rmSync(staging, {recursive: true, force: true});
  }
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
