import { describe, it, expect, beforeEach } from 'vitest';
import { AuthProfileManager } from '../../../src/core/auth-profile.js';
import { CreateAuthProfileInput, ApiKeyCredentials } from '../../../src/types/auth.js';

describe('AuthProfileManager', () => {
  let manager: AuthProfileManager;
  const testMasterKey = Buffer.from('a'.repeat(32), 'utf-8');

  const createTestProfileInput = (name: string): CreateAuthProfileInput => ({
    name,
    provider: 'anthropic',
    type: 'api_key',
    credentials: {
      type: 'api_key',
      apiKey: 'test-api-key',
    } as ApiKeyCredentials,
  });

  beforeEach(() => {
    manager = new AuthProfileManager();
    manager.setMasterKey(testMasterKey);
  });

  describe('createProfile', () => {
    it('should create a new profile', () => {
      const input = createTestProfileInput('Test Profile');
      const profile = manager.createProfile(input);

      expect(profile.id).toBeDefined();
      expect(profile.name).toBe(input.name);
      expect(profile.provider).toBe(input.provider);
      expect(profile.type).toBe(input.type);
      expect(profile.isActive).toBe(true);
      expect(profile.priority).toBe(0);
      expect(profile.fallbackChain).toEqual([]);
      expect(profile.createdAt).toBeGreaterThan(0);
      expect(profile.updatedAt).toBe(profile.createdAt);
    });

    it('should encrypt credentials', () => {
      const input = createTestProfileInput('Test Profile');
      const profile = manager.createProfile(input);

      // 암호화된 자격 증명은 JSON 형태
      expect(profile.encryptedCredentials).toContain('ciphertext');
      expect(profile.encryptedCredentials).toContain('salt');
      expect(profile.encryptedCredentials).toContain('nonce');
      expect(profile.encryptedCredentials).toContain('authTag');
    });

    it('should set custom priority and fallback chain', () => {
      const input: CreateAuthProfileInput = {
        ...createTestProfileInput('Test Profile'),
        priority: 5,
        fallbackChain: ['fallback-id-1', 'fallback-id-2'],
      };
      const profile = manager.createProfile(input);

      expect(profile.priority).toBe(5);
      expect(profile.fallbackChain).toEqual(['fallback-id-1', 'fallback-id-2']);
    });
  });

  describe('getProfile', () => {
    it('should return profile by id', () => {
      const input = createTestProfileInput('Test Profile');
      const created = manager.createProfile(input);

      const retrieved = manager.getProfile(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe(input.name);
    });

    it('should return undefined for non-existent id', () => {
      const profile = manager.getProfile('non-existent-id');
      expect(profile).toBeUndefined();
    });
  });

  describe('getCredentials', () => {
    it('should decrypt and return credentials', () => {
      const input = createTestProfileInput('Test Profile');
      const created = manager.createProfile(input);

      const credentials = manager.getCredentials(created.id);

      expect(credentials).toBeDefined();
      expect(credentials!.type).toBe('api_key');
      expect((credentials as ApiKeyCredentials).apiKey).toBe('test-api-key');
    });

    it('should return undefined for non-existent profile', () => {
      const credentials = manager.getCredentials('non-existent-id');
      expect(credentials).toBeUndefined();
    });
  });

  describe('getProfiles', () => {
    beforeEach(() => {
      manager.createProfile({ ...createTestProfileInput('Profile 1'), provider: 'anthropic', priority: 1 });
      manager.createProfile({ ...createTestProfileInput('Profile 2'), provider: 'openai', priority: 2 });
      manager.createProfile({ ...createTestProfileInput('Profile 3'), provider: 'anthropic', priority: 0 });
    });

    it('should return all profiles', () => {
      const profiles = manager.getAllProfiles();
      expect(profiles).toHaveLength(3);
    });

    it('should filter by provider', () => {
      const profiles = manager.getProfiles({ provider: 'anthropic' });
      expect(profiles).toHaveLength(2);
      expect(profiles.every(p => p.provider === 'anthropic')).toBe(true);
    });

    it('should sort by priority', () => {
      const profiles = manager.getProfiles(undefined, { field: 'priority', order: 'asc' });
      expect(profiles[0].priority).toBe(0);
      expect(profiles[1].priority).toBe(1);
      expect(profiles[2].priority).toBe(2);
    });
  });

  describe('updateProfile', () => {
    it('should update profile name', async () => {
      const input = createTestProfileInput('Original Name');
      const created = manager.createProfile(input);

      // 시간 차이를 위해 약간 대기
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = manager.updateProfile(created.id, { name: 'Updated Name' });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    });

    it('should update credentials', () => {
      const input = createTestProfileInput('Test Profile');
      const created = manager.createProfile(input);

      const newCredentials: ApiKeyCredentials = {
        type: 'api_key',
        apiKey: 'new-api-key',
      };

      manager.updateProfile(created.id, { credentials: newCredentials });

      const credentials = manager.getCredentials(created.id);
      expect((credentials as ApiKeyCredentials).apiKey).toBe('new-api-key');
    });

    it('should return undefined for non-existent profile', () => {
      const updated = manager.updateProfile('non-existent-id', { name: 'New Name' });
      expect(updated).toBeUndefined();
    });
  });

  describe('deleteProfile', () => {
    it('should delete profile', () => {
      const input = createTestProfileInput('Test Profile');
      const created = manager.createProfile(input);

      const deleted = manager.deleteProfile(created.id);

      expect(deleted).toBe(true);
      expect(manager.getProfile(created.id)).toBeUndefined();
    });

    it('should return false for non-existent profile', () => {
      const deleted = manager.deleteProfile('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('recordUsage', () => {
    it('should record usage and return true', () => {
      const input = createTestProfileInput('Test Profile');
      const created = manager.createProfile(input);

      const canUse = manager.recordUsage(created.id);

      expect(canUse).toBe(true);

      const profile = manager.getProfile(created.id)!;
      expect(profile.lastUsed).toBeGreaterThan(0);
      expect(profile.rateLimits.currentMinuteCount).toBe(1);
    });

    it('should return false for rate limited profile', () => {
      const input: CreateAuthProfileInput = {
        ...createTestProfileInput('Test Profile'),
        rateLimits: { requestsPerMinute: 2, requestsPerDay: 0 },
      };
      const created = manager.createProfile(input);

      // 2번 사용 (limit)
      expect(manager.recordUsage(created.id)).toBe(true);
      expect(manager.recordUsage(created.id)).toBe(true);

      // 3번째는 실패
      expect(manager.recordUsage(created.id)).toBe(false);
    });

    it('should return false for inactive profile', () => {
      const input = createTestProfileInput('Test Profile');
      const created = manager.createProfile(input);

      manager.updateProfile(created.id, { isActive: false });

      expect(manager.recordUsage(created.id)).toBe(false);
    });
  });

  describe('updateHealth', () => {
    it('should update health on success', () => {
      const input = createTestProfileInput('Test Profile');
      const created = manager.createProfile(input);

      manager.updateHealth(created.id, true);

      const profile = manager.getProfile(created.id)!;
      expect(profile.health.status).toBe('healthy');
      expect(profile.health.consecutiveFailures).toBe(0);
    });

    it('should update health on failure', () => {
      const input = createTestProfileInput('Test Profile');
      const created = manager.createProfile(input);

      manager.updateHealth(created.id, false, 'Error message');

      const profile = manager.getProfile(created.id)!;
      expect(profile.health.status).toBe('degraded');
      expect(profile.health.consecutiveFailures).toBe(1);
      expect(profile.health.lastError).toBe('Error message');
    });

    it('should transition to cooldown after 3 failures', () => {
      const input = createTestProfileInput('Test Profile');
      const created = manager.createProfile(input);

      manager.updateHealth(created.id, false);
      manager.updateHealth(created.id, false);
      manager.updateHealth(created.id, false);

      const profile = manager.getProfile(created.id)!;
      expect(profile.health.status).toBe('cooldown');
    });

    it('should transition to error after 5 failures', () => {
      const input = createTestProfileInput('Test Profile');
      const created = manager.createProfile(input);

      for (let i = 0; i < 5; i++) {
        manager.updateHealth(created.id, false);
      }

      const profile = manager.getProfile(created.id)!;
      expect(profile.health.status).toBe('error');
    });
  });

  describe('findFallbackProfile', () => {
    it('should find fallback profile when primary is unavailable', () => {
      const primary = manager.createProfile(createTestProfileInput('Primary'));
      const fallback = manager.createProfile(createTestProfileInput('Fallback'));

      // primary를 error 상태로 설정
      manager.updateProfile(primary.id, { fallbackChain: [fallback.id] });
      for (let i = 0; i < 5; i++) {
        manager.updateHealth(primary.id, false);
      }

      const found = manager.findFallbackProfile(primary.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(fallback.id);
    });

    it('should skip unavailable profiles in chain', () => {
      const primary = manager.createProfile(createTestProfileInput('Primary'));
      const fallback1 = manager.createProfile(createTestProfileInput('Fallback 1'));
      const fallback2 = manager.createProfile(createTestProfileInput('Fallback 2'));

      // primary와 fallback1은 error 상태로 설정
      manager.updateProfile(primary.id, { fallbackChain: [fallback1.id] });
      manager.updateProfile(fallback1.id, { fallbackChain: [fallback2.id] });

      for (let i = 0; i < 5; i++) {
        manager.updateHealth(primary.id, false);
        manager.updateHealth(fallback1.id, false);
      }

      const found = manager.findFallbackProfile(primary.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(fallback2.id);
    });
  });

  describe('getHighestPriorityProfile', () => {
    it('should return highest priority profile', () => {
      manager.createProfile({ ...createTestProfileInput('Low'), priority: 10 });
      const high = manager.createProfile({ ...createTestProfileInput('High'), priority: 1 });
      manager.createProfile({ ...createTestProfileInput('Medium'), priority: 5 });

      const found = manager.getHighestPriorityProfile();

      expect(found).toBeDefined();
      expect(found!.id).toBe(high.id);
    });

    it('should filter by provider', () => {
      const anthropic = manager.createProfile({
        ...createTestProfileInput('Anthropic'),
        provider: 'anthropic',
        priority: 5,
      });
      manager.createProfile({
        ...createTestProfileInput('OpenAI'),
        provider: 'openai',
        priority: 1,
      });

      const found = manager.getHighestPriorityProfile('anthropic');

      expect(found).toBeDefined();
      expect(found!.id).toBe(anthropic.id);
    });
  });

  describe('serialize/deserialize', () => {
    it('should serialize and deserialize profiles', () => {
      const profile = manager.createProfile(createTestProfileInput('Test'));

      const serialized = manager.serialize();
      const credentialsMap = new Map([[profile.id, profile.encryptedCredentials]]);

      const newManager = new AuthProfileManager();
      newManager.setMasterKey(testMasterKey);
      newManager.deserialize(serialized, credentialsMap);

      expect(newManager.count).toBe(1);
      expect(newManager.getProfile(profile.id)!.name).toBe('Test');
      expect(newManager.getCredentials(profile.id)).toBeDefined();
    });
  });
});
