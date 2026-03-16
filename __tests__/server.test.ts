import { describe, test, expect } from '@jest/globals';
import { app } from '../src/server';

describe('API endpoints', () => {
  test('PUT /admin/model should reject non-free model', async () => {
    const res = await app.request('/admin/model', {
      method: 'PUT',
      body: JSON.stringify({ model: 'paid-model' }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid free model');
  });

  test('PUT /admin/model should reject invalid request', async () => {
    const res = await app.request('/admin/model', {
      method: 'PUT',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' }
    });
    
    expect(res.status).toBe(400);
  });

  test('PUT /admin/model should reject empty model', async () => {
    const res = await app.request('/admin/model', {
      method: 'PUT',
      body: JSON.stringify({ model: '' }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    expect(res.status).toBe(400);
  });
});
