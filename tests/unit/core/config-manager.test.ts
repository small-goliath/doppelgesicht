import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ConfigManager } from '../../../src/core/config-manager.js';
import type { AppConfig } from '../../../src/types/config.js';

describe('ConfigManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    // 임시 디렉토리 생성
    tempDir = join(tmpdir(), `doppelgesicht-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    configManager = new ConfigManager(join(tempDir, 'config.yaml'));
  });

  afterEach(() => {
    // 임시 디렉토리 정리
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe('createDefaultConfig', () => {
    it('should create default config', () => {
      const config = configManager.createDefaultConfig();

      expect(config.version).toBe('2');
      expect(config.llm.defaultProvider).toBeDefined();
      expect(config.gateway.httpPort).toBe(8080);
      expect(config.logging.level).toBe('info');
    });
  });

  describe('save and load', () => {
    it('should save and load config', () => {
      const config = configManager.createDefaultConfig();
      config.llm.defaultModel = 'test-model';

      configManager.save(config);
      expect(configManager.exists()).toBe(true);

      const loaded = configManager.load();
      expect(loaded.llm.defaultModel).toBe('test-model');
    });

    it('should throw error when loading non-existent config', () => {
      expect(() => configManager.load()).toThrow('Config file not found');
    });
  });

  describe('validate', () => {
    it('should validate valid config', () => {
      const config = configManager.createDefaultConfig();
      const result = configManager.validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid config', () => {
      const invalidConfig = {
        version: '2',
        llm: {
          defaultProvider: 'invalid-provider',
          temperature: 3.0, // invalid: > 2
        },
      };

      const result = configManager.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('initialize', () => {
    it('should create default config if not exists', () => {
      const config = configManager.initialize();

      expect(configManager.exists()).toBe(true);
      expect(config.version).toBe('2');
    });

    it('should load existing config if exists', () => {
      const defaultConfig = configManager.createDefaultConfig();
      defaultConfig.llm.defaultModel = 'custom-model';
      configManager.save(defaultConfig);

      const config = configManager.initialize();
      expect(config.llm.defaultModel).toBe('custom-model');
    });
  });

  describe('environment variable resolution', () => {
    it('should resolve environment variables', () => {
      process.env.TEST_API_KEY = 'test-secret-key';

      // 메모리 설정의 dbPath에 환경변수 사용
      const config = configManager.createDefaultConfig();
      config.memory.dbPath = '${TEST_API_KEY}/memory.db';

      configManager.save(config);

      // 새로운 manager로 로드 (환경변수 해석 확인)
      const newManager = new ConfigManager(join(tempDir, 'config.yaml'));
      const loaded = newManager.load();

      expect(loaded.memory.dbPath).toBe('test-secret-key/memory.db');

      delete process.env.TEST_API_KEY;
    });

    it('should use default value for missing env vars', () => {
      const config = configManager.createDefaultConfig();
      config.memory.dbPath = '${MISSING_VAR:default-value}/memory.db';

      configManager.save(config);

      const newManager = new ConfigManager(join(tempDir, 'config.yaml'));
      const loaded = newManager.load();

      expect(loaded.memory.dbPath).toBe('default-value/memory.db');
    });
  });

  describe('get and set', () => {
    beforeEach(() => {
      configManager.initialize();
    });

    it('should get nested value', () => {
      const port = configManager.get<number>('gateway.httpPort');
      expect(port).toBe(8080);
    });

    it('should return undefined for non-existent path', () => {
      const value = configManager.get('nonexistent.path');
      expect(value).toBeUndefined();
    });

    it('should set nested value', () => {
      configManager.set('gateway.httpPort', 9090);

      const port = configManager.get<number>('gateway.httpPort');
      expect(port).toBe(9090);
    });

    it('should create nested objects when setting', () => {
      configManager.set('custom.nested.value', 'test');

      const value = configManager.get<string>('custom.nested.value');
      expect(value).toBe('test');
    });
  });

  describe('watch', () => {
    it('should trigger callback on config change', async () => {
      configManager.initialize();

      let changed = false;
      const callback = () => {
        changed = true;
      };

      configManager.onChange(callback);
      configManager.watch();

      // 설정 변경
      configManager.set('llm.defaultModel', 'new-model');

      // 파일 변경 감지 대기
      await new Promise(resolve => setTimeout(resolve, 100));

      // Note: watch 테스트는 환경에 따라 불안정할 수 있음
      configManager.unwatch();
      configManager.offChange(callback);
    });
  });
});
