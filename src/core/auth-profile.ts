/**
 * Auth Profile 관리 시스템
 * 프로파일 CRUD, 암호화 저장, fallback 체인, rate limiting
 */

import { randomUUID } from 'crypto';
import type {
  AuthProfile,
  CreateAuthProfileInput,
  UpdateAuthProfileInput,
  Credentials,
  ProfileFilterOptions,
  ProfileSortOptions,
  RateLimitConfig,
  HealthConfig,
  LLMProvider,
} from '../types/auth.js';
import {
  encryptString,
  decryptToString,
  serializeEncryptedData,
  deserializeEncryptedData,
} from '../security/crypto.js';

// 기본 Rate Limit 설정
const DEFAULT_RATE_LIMIT: Omit<RateLimitConfig, 'currentMinuteCount' | 'currentDayCount' | 'lastRequestTime' | 'lastDayResetTime'> = {
  requestsPerMinute: 60,
  requestsPerDay: 0, // 무제한
};

// 기본 Health 설정
const DEFAULT_HEALTH: Omit<HealthConfig, 'lastCheckTime'> = {
  status: 'healthy',
  consecutiveFailures: 0,
  successRate: 1.0,
};

/**
 * Auth Profile Manager 클래스
 */
export class AuthProfileManager {
  private profiles: Map<string, AuthProfile> = new Map();
  private masterKey: Buffer | null = null;

  /**
   * 마스터 키를 설정합니다
   * @param key - 마스터 키
   */
  setMasterKey(key: Buffer): void {
    this.masterKey = key;
  }

  /**
   * 마스터 키가 설정되어 있는지 확인합니다
   * @returns 설정 여부
   */
  hasMasterKey(): boolean {
    return this.masterKey !== null;
  }

  /**
   * 마스터 키를 검증합니다
   * @throws 마스터 키가 없으면 에러
   */
  private ensureMasterKey(): Buffer {
    if (!this.masterKey) {
      throw new Error('Master key not set. Call setMasterKey() first.');
    }
    return this.masterKey;
  }

  /**
   * 자격 증명을 암호화합니다
   * @param credentials - 자격 증명
   * @returns 암호화된 문자열
   */
  private encryptCredentials(credentials: Credentials): string {
    const key = this.ensureMasterKey();
    const jsonString = JSON.stringify(credentials);
    const encrypted = encryptString(jsonString, key);
    return serializeEncryptedData(encrypted);
  }

  /**
   * 자격 증명을 복호화합니다
   * @param encryptedData - 암호화된 데이터
   * @returns 복호화된 자격 증명
   */
  private decryptCredentials(encryptedData: string): Credentials {
    const key = this.ensureMasterKey();
    const encrypted = deserializeEncryptedData(encryptedData);
    const jsonString = decryptToString(encrypted, key);
    return JSON.parse(jsonString) as Credentials;
  }

  /**
   * 새로운 Auth Profile을 생성합니다
   * @param input - 생성 입력
   * @returns 생성된 프로파일
   */
  createProfile(input: CreateAuthProfileInput): AuthProfile {
    const now = Date.now();

    const rateLimits: RateLimitConfig = {
      ...DEFAULT_RATE_LIMIT,
      ...input.rateLimits,
      currentMinuteCount: 0,
      currentDayCount: 0,
      lastRequestTime: 0,
      lastDayResetTime: now,
    };

    const health: HealthConfig = {
      ...DEFAULT_HEALTH,
      lastCheckTime: now,
    };

    const profile: AuthProfile = {
      id: randomUUID(),
      name: input.name,
      provider: input.provider,
      type: input.type,
      encryptedCredentials: this.encryptCredentials(input.credentials),
      rateLimits,
      health,
      lastUsed: 0,
      failCount: 0,
      priority: input.priority ?? 0,
      fallbackChain: input.fallbackChain ?? [],
      createdAt: now,
      updatedAt: now,
      isActive: true,
      metadata: input.metadata,
    };

    this.profiles.set(profile.id, profile);
    return profile;
  }

  /**
   * 프로파일을 조회합니다
   * @param id - 프로파일 ID
   * @returns 프로파일 또는 undefined
   */
  getProfile(id: string): AuthProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * 프로파일의 자격 증명을 복호화하여 조회합니다
   * @param id - 프로파일 ID
   * @returns 자격 증명 또는 undefined
   */
  getCredentials(id: string): Credentials | undefined {
    const profile = this.profiles.get(id);
    if (!profile) return undefined;

    try {
      return this.decryptCredentials(profile.encryptedCredentials);
    } catch {
      return undefined;
    }
  }

  /**
   * 모든 프로파일을 조회합니다
   * @returns 프로파일 배열
   */
  getAllProfiles(): AuthProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * 필터링된 프로파일 목록을 조회합니다
   * @param filter - 필터 옵션
   * @param sort - 정렬 옵션
   * @returns 필터링된 프로파일 배열
   */
  getProfiles(
    filter?: ProfileFilterOptions,
    sort?: ProfileSortOptions
  ): AuthProfile[] {
    let profiles = this.getAllProfiles();

    // 필터링
    if (filter) {
      profiles = profiles.filter((profile) => {
        if (filter.provider && profile.provider !== filter.provider) return false;
        if (filter.status && profile.health.status !== filter.status) return false;
        if (filter.isActive !== undefined && profile.isActive !== filter.isActive) return false;
        if (filter.minPriority !== undefined && profile.priority < filter.minPriority) return false;
        if (filter.maxPriority !== undefined && profile.priority > filter.maxPriority) return false;
        return true;
      });
    }

    // 정렬
    if (sort) {
      profiles.sort((a, b) => {
        let comparison = 0;
        switch (sort.field) {
          case 'priority':
            comparison = a.priority - b.priority;
            break;
          case 'lastUsed':
            comparison = a.lastUsed - b.lastUsed;
            break;
          case 'createdAt':
            comparison = a.createdAt - b.createdAt;
            break;
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
        }
        return sort.order === 'asc' ? comparison : -comparison;
      });
    }

    return profiles;
  }

  /**
   * 프로파일을 업데이트합니다
   * @param id - 프로파일 ID
   * @param input - 업데이트 입력
   * @returns 업데이트된 프로파일 또는 undefined
   */
  updateProfile(id: string, input: UpdateAuthProfileInput): AuthProfile | undefined {
    const profile = this.profiles.get(id);
    if (!profile) return undefined;

    const now = Date.now();

    // 이름 업데이트
    if (input.name !== undefined) {
      profile.name = input.name;
    }

    // 자격 증명 업데이트
    if (input.credentials !== undefined) {
      profile.encryptedCredentials = this.encryptCredentials(input.credentials);
    }

    // Rate Limit 업데이트
    if (input.rateLimits !== undefined) {
      profile.rateLimits = {
        ...profile.rateLimits,
        ...input.rateLimits,
      };
    }

    // 우선순위 업데이트
    if (input.priority !== undefined) {
      profile.priority = input.priority;
    }

    // Fallback 체인 업데이트
    if (input.fallbackChain !== undefined) {
      profile.fallbackChain = input.fallbackChain;
    }

    // 활성화 상태 업데이트
    if (input.isActive !== undefined) {
      profile.isActive = input.isActive;
    }

    // 메타데이터 업데이트
    if (input.metadata !== undefined) {
      profile.metadata = { ...profile.metadata, ...input.metadata };
    }

    profile.updatedAt = now;
    return profile;
  }

  /**
   * 프로파일을 삭제합니다
   * @param id - 프로파일 ID
   * @returns 삭제 성공 여부
   */
  deleteProfile(id: string): boolean {
    return this.profiles.delete(id);
  }

  /**
   * 프로파일 사용을 기록하고 rate limit을 체크합니다
   * @param id - 프로파일 ID
   * @returns 사용 가능 여부
   */
  recordUsage(id: string): boolean {
    const profile = this.profiles.get(id);
    if (!profile || !profile.isActive) return false;

    const now = Date.now();
    const rateLimits = profile.rateLimits;

    // 일 카운터 리셋 (24시간 경과)
    if (now - rateLimits.lastDayResetTime >= 24 * 60 * 60 * 1000) {
      rateLimits.currentDayCount = 0;
      rateLimits.lastDayResetTime = now;
    }

    // 분 카운터 리셋 (1분 경과)
    if (now - rateLimits.lastRequestTime >= 60 * 1000) {
      rateLimits.currentMinuteCount = 0;
    }

    // Rate Limit 체크
    if (rateLimits.currentMinuteCount >= rateLimits.requestsPerMinute) {
      return false;
    }

    if (rateLimits.requestsPerDay > 0 && rateLimits.currentDayCount >= rateLimits.requestsPerDay) {
      return false;
    }

    // 사용 기록
    rateLimits.currentMinuteCount++;
    rateLimits.currentDayCount++;
    rateLimits.lastRequestTime = now;
    profile.lastUsed = now;

    return true;
  }

  /**
   * 프로파일 상태를 업데이트합니다
   * @param id - 프로파일 ID
   * @param success - 성공 여부
   * @param errorMessage - 에러 메시지 (실패 시)
   */
  updateHealth(id: string, success: boolean, errorMessage?: string): void {
    const profile = this.profiles.get(id);
    if (!profile) return;

    const now = Date.now();
    const health = profile.health;

    health.lastCheckTime = now;

    if (success) {
      health.consecutiveFailures = 0;
      health.successRate = Math.min(1, health.successRate * 0.9 + 0.1);
      health.status = 'healthy';
    } else {
      health.consecutiveFailures++;
      health.successRate = Math.max(0, health.successRate * 0.9);
      health.lastError = errorMessage;
      health.lastErrorTime = now;
      profile.failCount++;

      // 상태 업데이트
      if (health.consecutiveFailures >= 5) {
        health.status = 'error';
      } else if (health.consecutiveFailures >= 3) {
        health.status = 'cooldown';
      } else if (health.consecutiveFailures >= 1) {
        health.status = 'degraded';
      }
    }
  }

  /**
   * Fallback 체인을 따라 다음 사용 가능한 프로파일을 찾습니다
   * @param startId - 시작 프로파일 ID
   * @returns 사용 가능한 프로파일 또는 undefined
   */
  findFallbackProfile(startId: string): AuthProfile | undefined {
    const visited = new Set<string>();
    let currentId: string | undefined = startId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const profile = this.profiles.get(currentId);

      if (!profile) break;

      // 사용 가능한지 체크
      if (profile.isActive && profile.health.status !== 'error' && profile.health.status !== 'cooldown') {
        // Rate Limit 체크
        if (this.recordUsage(currentId)) {
          return profile;
        }
      }

      // Fallback 체인의 다음 프로파일로 이동
      currentId = profile.fallbackChain[0];
    }

    return undefined;
  }

  /**
   * 우선순위가 가장 높은 (값이 가장 낮은) 활성 프로파일을 찾습니다
   * @param provider - 특정 제공자로 필터링 (선택적)
   * @returns 프로파일 또는 undefined
   */
  getHighestPriorityProfile(provider?: LLMProvider): AuthProfile | undefined {
    const profiles = this.getProfiles(
      { isActive: true, provider },
      { field: 'priority', order: 'asc' }
    );

    for (const profile of profiles) {
      if (profile.health.status !== 'error' && profile.health.status !== 'cooldown') {
        if (this.recordUsage(profile.id)) {
          return profile;
        }
      }
    }

    return undefined;
  }

  /**
   * 모든 프로파일을 직렬화합니다 (저장용)
   * @returns 직렬화된 프로파일 배열
   */
  serialize(): Omit<AuthProfile, 'encryptedCredentials'>[] {
    return this.getAllProfiles().map((profile) => {
      const { encryptedCredentials, ...rest } = profile;
      return rest;
    });
  }

  /**
   * 직렬화된 프로파일을 로드합니다
   * @param data - 직렬화된 데이터
   * @param credentialsMap - ID -> 암호화된 자격 증명 매핑
   */
  deserialize(
    data: Omit<AuthProfile, 'encryptedCredentials'>[],
    credentialsMap: Map<string, string>
  ): void {
    this.profiles.clear();

    for (const profileData of data) {
      const encryptedCredentials = credentialsMap.get(profileData.id);
      if (encryptedCredentials) {
        const profile: AuthProfile = {
          ...profileData,
          encryptedCredentials,
        };
        this.profiles.set(profile.id, profile);
      }
    }
  }

  /**
   * 프로파일 수를 반환합니다
   * @returns 프로파일 수
   */
  get count(): number {
    return this.profiles.size;
  }

  /**
   * 모든 프로파일을 제거합니다
   */
  clear(): void {
    this.profiles.clear();
  }
}
