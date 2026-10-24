/* Loads the app's data/number/generator/store scripts into a plain Node
 * context (no browser), for unit tests. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

module.exports = function load(files = ["data.js", "numbers.js", "gen.js", "store.js"]) {
  const mem = {};
  const ctx = {
    console,
    localStorage: {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => (mem[k] = String(v)),
      removeItem: (k) => delete mem[k],
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8"), ctx, { filename: f });
  }
  return ctx.App;
};
