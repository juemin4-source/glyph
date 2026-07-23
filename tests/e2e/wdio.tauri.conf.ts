import type { Options } from '@wdio/types';
export const config: Options.Testrunner = {
  runner: 'local',
  autoCompileOpts: { autoCompile: true, tsNodeOpts: { transpileOnly: true } },
  specs: ['./e2e/tauri/**/*.spec.ts'],
  capabilities: [{
    maxInstances: 1,
    'tauri:options': { application: './target/debug/glyph.exe' },
    browserName: 'tauri',
  }],
  logLevel: 'info',
  outputDir: 'e2e/test-results',
  framework: 'mocha',
  mochaOpts: { timeout: 30000, ui: 'bdd' },
  services: [['tauri', { driver: { port: 4444 } }]],
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
};
