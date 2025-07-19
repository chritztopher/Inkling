/**
 * Quick test to verify the core infrastructure implementations
 */

// Test environment validation
console.log('Testing environment validation...');
try {
  const env = require('./utils/env.ts');
  console.log('✅ Environment module loaded');
  console.log('📊 Environment info:', env.getEnvironmentInfo());
} catch (error) {
  console.log('❌ Environment test failed:', error.message);
}

// Test error handling
console.log('\nTesting error handling...');
try {
  const errors = require('./utils/errors.ts');
  
  // Test creating different error types
  const networkError = new errors.NetworkError('Test network error', 500, 'https://test.com');
  const audioError = new errors.AudioError('Test audio error', 'PLAY');
  
  console.log('✅ Error classes created successfully');
  console.log('📊 Network error:', networkError.toJSON());
  console.log('📊 Audio error:', audioError.toJSON());
  
  // Test error message helper
  const message = errors.getErrorMessage(networkError);
  console.log('📊 User-friendly message:', message);
  
} catch (error) {
  console.log('❌ Error handling test failed:', error.message);
}

console.log('\n✅ Infrastructure test completed');