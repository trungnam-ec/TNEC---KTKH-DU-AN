// polyfill for pdf-parse in Node.js
if (typeof global !== 'undefined' && !(global as any).DOMMatrix) {
  (global as any).DOMMatrix = class DOMMatrix {
    constructor() {}
  };
}
