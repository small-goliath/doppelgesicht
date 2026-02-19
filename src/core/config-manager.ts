/**
 * 설정 파일 관리 시스템
 * YAML 설정, 환경변수 참조, 스키마 검증, 핫 리로드
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, watch, type FSWatcher } from 'fs';
import { dirname, join, resolve } from 'path';
import { homedir } from 'os';
import { load, dump } from 'js-yaml';
import { z } from 'zod';
import type { AppConfig, ConfigChangeCallback, ConfigValidationResult } from '../types/config.js';

// 기본 설정 디렉토리
const DEFAULT_CONFIG_DIR = join(homedir(), '.doppelgesicht');
const DEFAULT_CONFIG_PATH = join(DEFAULT_CONFIG_DIR, 'config.yaml');

// Zod 스키마 정의
const LLMConfigSchema = z.object({
  defaultProvider: z.enum(['anthropic', 'openai']).default('anthropic'),
  defaultModel: z.string().default('claude-3-opus-20240229'),
  maxTokens: z.number().int().min(1).max(8192).default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
});

const ChannelConfigSchema = z.object({
  enabled: z.boolean().default(false),
  telegram: z.object({
    botToken: z.string().optional(),
    allowedUsers: z.array(z.string()).optional(),
  }).optional(),
  slack: z.object({
    appToken: z.string().optional(),
    botToken: z.string().optional(),
    allowedUsers: z.array(z.string()).optional(),
  }).optional(),
  discord: z.object({
    botToken: z.string().optional(),
    allowedUsers: z.array(z.string()).optional(),
    allowedChannels: z.array(z.string()).optional(),
    allowedGuilds: z.array(z.string()).optional(),
    allowDMs: z.boolean().optional(),
  }).optional(),
});

const GatewayConfigSchema = z.object({
  httpPort: z.number().int().min(1).max(65535).default(8080),
  wsPort: z.number().int().min(1).max(65535).default(8081),
  host: z.string().default('127.0.0.1'),
  cors: z.object({
    origins: z.array(z.string()).default(['http://localhost:3000']),
  }).optional(),
  auth: z.object({
    jwtSecret: z.string().default(''),
    tokenExpiry: z.number().int().default(3600),
  }).optional(),
});

const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  console: z.boolean().default(true),
  file: z.object({
    enabled: z.boolean().default(false),
    path: z.string().default(join(DEFAULT_CONFIG_DIR, 'logs', 'app.log')),
    maxSize: z.string().default('10m'),
    maxFiles: z.number().int().default(5),
  }).optional(),
  json: z.boolean().default(true),
});

const SupabaseConfigSchema = z.object({
  url: z.string().url(),
  anonKey: z.string(),
  options: z.object({
    auth: z.object({
      persistSession: z.boolean().default(true),
      autoRefreshToken: z.boolean().default(true),
    }).optional(),
    db: z.object({
      schema: z.string().default('public'),
    }).optional(),
    realtime: z.object({
      enabled: z.boolean().default(true),
    }).optional(),
  }).optional(),
});

const MemoryConfigSchema = z.object({
  dbPath: z.string().default(join(DEFAULT_CONFIG_DIR, 'memory.db')),
  maxContextLength: z.number().int().min(1).default(10),
  sessionExpiry: z.number().int().default(7 * 24 * 60 * 60 * 1000), // 7일
  supabase: SupabaseConfigSchema.default({
    url: process.env.SUPABASE_URL || 'https://default.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || 'default-key',
  }),
  localCache: z.object({
    enabled: z.boolean().default(true),
    dbPath: z.string().default(join(DEFAULT_CONFIG_DIR, 'cache.db')),
  }).optional(),
});

const SecurityConfigSchema = z.object({
  approvalMode: z.enum(['interactive', 'whitelist']).default('interactive'),
  whitelistedTools: z.array(z.string()).optional(),
  timeouts: z.object({
    low: z.number().int().default(30),
    medium: z.number().int().default(60),
    high: z.number().int().default(120),
    critical: z.number().int().default(120),
  }).default({}),
});

const AppConfigSchema = z.object({
  version: z.string().default('2'),
  llm: LLMConfigSchema.default({}),
  channels: ChannelConfigSchema.default({}),
  gateway: GatewayConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),
  memory: MemoryConfigSchema.default({}),
  security: SecurityConfigSchema.default({}),
});

/**
 * 환경변수 참조를 해석합니다 (${VAR} 또는 ${VAR:default} 문법)
 * @param value - 해석할 문자열
 * @returns 환경변수가 치환된 문자열
 */
function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, content) => {
    const [varName, defaultValue] = content.split(':');
    const envValue = process.env[varName];
    return envValue !== undefined ? envValue : (defaultValue || match);
  });
}

/**
 * 객체의 모든 문자열 값에서 환경변수 참조를 해석합니다
 * @param obj - 해석할 객체
 * @returns 환경변수가 치환된 객체
 */
function resolveEnvVarsInObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return resolveEnvVars(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(resolveEnvVarsInObject);
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvVarsInObject(value);
    }
    return result;
  }

  return obj;
}

/**
 * 설정 관리자 클래스
 */
export class ConfigManager {
  private config: AppConfig | null = null;
  private configPath: string;
  private watcher: FSWatcher | null = null;
  private changeCallbacks: ConfigChangeCallback[] = [];

  /**
   * 설정 관리자를 생성합니다
   * @param configPath - 설정 파일 경로 (기본값: ~/.doppelgesicht/config.yaml)
   */
  constructor(configPath: string = DEFAULT_CONFIG_PATH) {
    this.configPath = resolve(configPath);
  }

  /**
   * 설정 파일 경로를 반환합니다
   * @returns 설정 파일 경로
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 설정 파일이 존재하는지 확인합니다
   * @returns 존재 여부
   */
  exists(): boolean {
    return existsSync(this.configPath);
  }

  /**
   * 설정을 로드합니다
   * @returns 로드된 설정
   * @throws 파일이 없거나 파싱/검증 실패 시 에러
   */
  load(): AppConfig {
    if (!this.exists()) {
      throw new Error(`Config file not found: ${this.configPath}`);
    }

    const content = readFileSync(this.configPath, 'utf-8');
    const parsed = load(content) as Record<string, unknown>;

    // 환경변수 해석
    const resolved = resolveEnvVarsInObject(parsed) as Record<string, unknown>;

    // 스키마 검증 및 기본값 적용
    const result = AppConfigSchema.safeParse(resolved);

    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Config validation failed:\n${errors.join('\n')}`);
    }

    this.config = result.data;
    return this.config;
  }

  /**
   * 설정을 저장합니다
   * @param config - 저장할 설정
   */
  save(config: AppConfig): void {
    // 스키마 검증
    const result = AppConfigSchema.safeParse(config);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Config validation failed:\n${errors.join('\n')}`);
    }

    // 디렉토리 생성
    const configDir = dirname(this.configPath);
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // YAML 직렬화
    const yaml = dump(config, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: true,
    });

    writeFileSync(this.configPath, yaml, 'utf-8');
    this.config = config;
  }

  /**
   * 현재 설정을 반환합니다
   * @returns 현재 설정 (로드되지 않았으면 null)
   */
  getConfig(): AppConfig | null {
    return this.config;
  }

  /**
   * 설정을 검증합니다
   * @param config - 검증할 설정
   * @returns 검증 결과
   */
  validate(config: unknown): ConfigValidationResult {
    const result = AppConfigSchema.safeParse(config);

    if (result.success) {
      return { valid: true, errors: [] };
    }

    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    return { valid: false, errors };
  }

  /**
   * 기본 설정을 생성합니다
   * @returns 기본 설정 객체
   */
  createDefaultConfig(): AppConfig {
    return AppConfigSchema.parse({});
  }

  /**
   * 설정 파일이 없으면 기본 설정으로 초기화합니다
   * @returns 초기화된 설정
   */
  initialize(): AppConfig {
    if (this.exists()) {
      return this.load();
    }

    const defaultConfig = this.createDefaultConfig();
    this.save(defaultConfig);
    return defaultConfig;
  }

  /**
   * 설정 변경 감시를 시작합니다 (핫 리로드)
   */
  watch(): void {
    if (this.watcher) {
      return;
    }

    if (!this.exists()) {
      throw new Error(`Cannot watch non-existent config: ${this.configPath}`);
    }

    this.watcher = watch(this.configPath, (eventType) => {
      if (eventType === 'change') {
        try {
          const newConfig = this.load();
          this.notifyChange(newConfig);
        } catch (error) {
          console.error('Failed to reload config:', error);
        }
      }
    });
  }

  /**
   * 설정 변경 감시를 중지합니다
   */
  unwatch(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * 설정 변경 콜백을 등록합니다
   * @param callback - 변경 시 호출될 콜백
   */
  onChange(callback: ConfigChangeCallback): void {
    this.changeCallbacks.push(callback);
  }

  /**
   * 설정 변경 콜백을 제거합니다
   * @param callback - 제거할 콜백
   */
  offChange(callback: ConfigChangeCallback): void {
    const index = this.changeCallbacks.indexOf(callback);
    if (index !== -1) {
      this.changeCallbacks.splice(index, 1);
    }
  }

  /**
   * 모든 변경 콜백을 호출합니다
   * @param config - 새 설정
   */
  private notifyChange(config: AppConfig): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback(config);
      } catch (error) {
        console.error('Config change callback error:', error);
      }
    }
  }

  /**
   * 특정 경로의 설정 값을 가져옵니다
   * @param path - 점으로 구분된 경로 (예: 'llm.defaultModel')
   * @returns 설정 값 또는 undefined
   */
  get<T>(path: string): T | undefined {
    if (!this.config) {
      return undefined;
    }

    const keys = path.split('.');
    let current: unknown = this.config;

    for (const key of keys) {
      if (current === null || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current as T;
  }

  /**
   * 특정 경로의 설정 값을 설정합니다
   * @param path - 점으로 구분된 경로
   * @param value - 설정할 값
   */
  set<T>(path: string, value: T): void {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    const keys = path.split('.');
    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
    this.save(this.config);
  }
}

/**
 * 전역 설정 관리자 인스턴스
 */
let globalConfigManager: ConfigManager | null = null;

/**
 * 전역 설정 관리자를 가져옵니다
 * @returns 설정 관리자 인스턴스
 */
export function getConfigManager(): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager();
  }
  return globalConfigManager;
}

/**
 * 전역 설정 관리자를 설정합니다
 * @param manager - 설정 관리자 인스턴스
 */
export function setConfigManager(manager: ConfigManager): void {
  globalConfigManager = manager;
}
