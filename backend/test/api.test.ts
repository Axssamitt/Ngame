import { describe, it, expect } from 'vitest';
import app from '../src/index.js';

describe('Backend API Endpoints', () => {
  it('should register a new user and return auth token', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testmage_' + Date.now(),
        password: 'password123',
        characterName: 'Archmage Nova',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.token).toBeDefined();
    expect(body.user.username).toContain('testmage_');
    expect(body.character.name).toBe('Archmage Nova');
  });

  it('should list portals', async () => {
    const res = await app.request('/api/portals');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.portals)).toBe(true);
  });
});
