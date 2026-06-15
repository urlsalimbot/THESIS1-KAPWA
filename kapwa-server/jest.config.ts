module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.interface.ts',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/database/**',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
