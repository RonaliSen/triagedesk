// Test files share one module registry in this project's test runner
// (isolate: false), so Dexie's one-time globalThis.indexedDB snapshot must
// be polyfilled here, before any spec file gets a chance to import `dexie`
// first and lock in a missing reference.
import 'fake-indexeddb/auto';
