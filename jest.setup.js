// Jest setup file for global mocks and configurations

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}

// Mock setTimeout and clearTimeout for testing
global.setTimeout = jest.fn((fn, delay) => {
  if (typeof fn === 'function') {
    return setImmediate(fn)
  }
  return 1
})

global.clearTimeout = jest.fn()

// Mock AbortController for Node.js environment
global.AbortController = class AbortController {
  constructor() {
    this.signal = {
      aborted: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
  }
  
  abort() {
    this.signal.aborted = true
  }
}