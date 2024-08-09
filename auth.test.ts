import { expect, test, mock, beforeAll, afterAll } from 'bun:test';
import { AuthManager } from './auth';
import {
  initializeDatabase,
  generateLoginCode,
  validateLoginCode,
  clearOldRequests,
} from './db';
import { sendEmail } from './email';
import { unlink } from 'fs/promises';

const TEST_DB_NAME = 'test_db1.sqlite';

beforeAll(() => {
  // Initialize the test database
  initializeDatabase(TEST_DB_NAME);
});

afterAll(async () => {
  // Clean up the test database
  // await unlink(TEST_DB_NAME);
});

test('AuthManager.sendLoginCode sends a login code to a real email', async () => {
  const authManager = new AuthManager();
  const email = 'sammypwns@gmail.com';

  const result = await authManager.sendLoginCode(email);

  expect(result).toBe(true);

  // Add a small delay to allow for any asynchronous processes to complete
  await new Promise((resolve) => setTimeout(resolve, 2000));
}, 10000); // Increase timeout to 10 seconds for this test

test('AuthManager.verifyLoginCode validates a correct login code', () => {
  const authManager = new AuthManager();
  const email = 'test@example.com';
  const code = generateLoginCode(email);

  const result = authManager.verifyLoginCode(email, code);

  expect(result).toBe(true);
});

test('AuthManager.verifyLoginCode rejects an incorrect login code', () => {
  const authManager = new AuthManager();
  const email = 'test@example.com';
  generateLoginCode(email); // Generate a valid code
  const incorrectCode = '000000';

  const result = authManager.verifyLoginCode(email, incorrectCode);

  expect(result).toBe(false);
});

test('AuthManager.issueToken generates a valid JWT', () => {
  const authManager = new AuthManager();
  const email = 'test@example.com';

  const token = authManager.issueToken(email);

  expect(token).toBeTruthy();
  expect(typeof token).toBe('string');
});

test('AuthManager.verifyToken validates a correct token', () => {
  const authManager = new AuthManager();
  const email = 'test@example.com';

  const token = authManager.issueToken(email);
  const result = authManager.verifyToken(token);

  expect(result).toBe(email);
});

test('AuthManager.verifyToken rejects an invalid token', () => {
  const authManager = new AuthManager();
  const invalidToken = 'invalid.token.here';

  const result = authManager.verifyToken(invalidToken);

  expect(result).toBeNull();
});
