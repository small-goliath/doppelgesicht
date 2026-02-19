/**
 * Onboard CLI 명령어
 * @description 초기 설정 마법사 CLI 구현
 */

import * as p from '@clack/prompts';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Command } from 'commander';

// ANSI 색상 코드
const colors = {
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};
import { ConfigManager } from '../../core/config-manager.js';
import { AuthProfileManager } from '../../core/auth-profile.js';
import {
  deriveMasterKey,
  validatePasswordComplexity,
  verifyAndRecoverKey,
} from '../../security/master-key.js';
import type { AppConfig } from '../../types/config.js';
import type { LLMProvider } from '../../types/auth.js';
import { createLogger } from '../../logging/index.js';

// 기본 설정 디렉토리
const DEFAULT_CONFIG_DIR = join(homedir(), '.doppelgesicht');
const DEFAULT_CONFIG_PATH = join(DEFAULT_CONFIG_DIR, 'config.yaml');
const MASTER_KEY_FILE = join(DEFAULT_CONFIG_DIR, 'master.key');

/**
 * Onboard 명령어 등록
 */
export function registerOnboardCommand(program: Command): void {
  program
    .command('onboard')
    .description('초기 설정 마법사를 실행합니다')
    .option('-f, --force', '기존 설정 덮어쓰기')
    .action(async (options) => {
      const onboard = new OnboardWizard(options.force);
      await onboard.run();
    });
}

/**
 * Onboard 마법사 클래스
 */
class OnboardWizard {
  private force: boolean;
  private logger = createLogger({ level: 'info', console: true, json: false });

  constructor(force = false) {
    this.force = force;
  }

  /**
   * 마법사 실행
   */
  async run(): Promise<void> {
    console.clear();
    p.intro(colors.cyan('🎭 Doppelgesicht 초기 설정 마법사'));

    // 기존 설정 확인
    const configManager = new ConfigManager(DEFAULT_CONFIG_PATH);
    if (configManager.exists() && !this.force) {
      const overwrite = await p.confirm({
        message: '기존 설정이 존재합니다. 덮어쓰시겠습니까?',
        initialValue: false,
      });

      if (p.isCancel(overwrite) || !overwrite) {
        p.outro(colors.yellow('설정이 취소되었습니다.'));
        return;
      }
    }

    try {
      // 1. 마스터 비밀번호 설정
      const masterKeyResult = await this.setupMasterPassword();
      if (!masterKeyResult) {
        p.outro(colors.red('마스터 비밀번호 설정에 실패했습니다.'));
        return;
      }

      // 2. LLM 제공자 설정
      const llmConfig = await this.setupLLMProvider();

      // 3. 채널 설정 (선택)
      const channelConfig = await this.setupChannels();

      // 4. 설정 파일 생성
      const config = this.createConfig(llmConfig, channelConfig);
      configManager.save(config);

      // 5. 마스터 키 저장
      await this.saveMasterKey(masterKeyResult.hash);

      // 6. Auth Profile 생성
      await this.createAuthProfile(masterKeyResult.key, llmConfig);

      // 7. 기존 평문 자격 증명 마이그레이션 확인
      await this.checkPlaintextMigration();

      // 메모리 정리
      masterKeyResult.key.fill(0);

      p.outro(colors.green('✅ 초기 설정이 완료되었습니다!'));
      p.log.info(colors.dim(`설정 파일: ${DEFAULT_CONFIG_PATH}`));
      p.log.info(colors.dim('이제 `doppelgesicht start`로 서버를 시작할 수 있습니다.'));
    } catch (error) {
      this.logger.error('Onboard failed', { error });
      p.outro(colors.red('설정 중 오류가 발생했습니다.'));
      process.exit(1);
    }
  }

  /**
   * 마스터 비밀번호 설정
   */
  private async setupMasterPassword(): Promise<{ hash: string; key: Buffer } | null> {
    p.log.step('🔐 마스터 비밀번호 설정');

    const password = await p.password({
      message: '마스터 비밀번호를 입력하세요:',
      validate: (value) => {
        const result = validatePasswordComplexity(value);
        if (!result.valid) {
          return result.errors.join('\n');
        }
      },
    });

    if (p.isCancel(password)) {
      return null;
    }

    // 비밀번호 복잡도 표시
    this.showPasswordStrength(password);

    // 비밀번호 확인
    const confirmPassword = await p.password({
      message: '비밀번호를 다시 입력하세요:',
    });

    if (p.isCancel(confirmPassword)) {
      return null;
    }

    if (password !== confirmPassword) {
      p.log.error('비밀번호가 일치하지 않습니다.');
      return null;
    }

    // 마스터 키 파생
    const spinner = p.spinner();
    spinner.start('마스터 키를 생성하는 중...');

    try {
      const result = await deriveMasterKey(password);
      spinner.stop('마스터 키가 생성되었습니다.');
      return result;
    } catch (error) {
      spinner.stop('마스터 키 생성에 실패했습니다.');
      return null;
    }
  }

  /**
   * 비밀번호 강도 표시
   */
  private showPasswordStrength(password: string): void {
    let strength = 0;
    const checks = [
      password.length >= 12,
      password.length >= 16,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    ];

    strength = checks.filter(Boolean).length;

    const strengthText = ['매우 약함', '약함', '보통', '강함', '매우 강함'];
    const strengthColor = [colors.red, colors.red, colors.yellow, colors.green, colors.green];

    const index = Math.min(Math.floor((strength / 6) * 5), 4);
    p.log.info(`비밀번호 강도: ${strengthColor[index](strengthText[index])}`);
  }

  /**
   * LLM 제공자 설정
   */
  private async setupLLMProvider(): Promise<{
    provider: LLMProvider;
    apiKey: string;
    model: string;
  }> {
    p.log.step('🤖 LLM 제공자 설정');

    const provider = await p.select<{
      value: LLMProvider;
      label: string;
      hint?: string;
    }[]>({
      message: 'LLM 제공자를 선택하세요:',
      options: [
        {
          value: 'anthropic',
          label: 'Anthropic (Claude)',
          hint: '권장',
        },
        {
          value: 'openai',
          label: 'OpenAI (GPT)',
        },
      ],
    });

    if (p.isCancel(provider)) {
      throw new Error('사용자가 취소했습니다');
    }

    // API 키 입력
    const apiKey = await p.password({
      message: `${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API 키를 입력하세요:`,
      validate: (value) => {
        if (!value || value.length < 10) {
          return '유효한 API 키를 입력하세요';
        }
        if (provider === 'anthropic' && !value.startsWith('sk-ant-')) {
          return 'Anthropic API 키는 sk-ant-로 시작해야 합니다';
        }
        if (provider === 'openai' && !value.startsWith('sk-')) {
          return 'OpenAI API 키는 sk-로 시작해야 합니다';
        }
      },
    });

    if (p.isCancel(apiKey)) {
      throw new Error('사용자가 취소했습니다');
    }

    // API 키 검증
    const spinner = p.spinner();
    spinner.start('API 키를 검증하는 중...');

    const isValid = await this.validateApiKey(provider, apiKey);

    if (isValid) {
      spinner.stop('API 키가 유효합니다.');
    } else {
      spinner.stop('API 키 검증에 실패했습니다.');
      const continueAnyway = await p.confirm({
        message: '계속 진행하시겠습니까?',
        initialValue: false,
      });

      if (!continueAnyway || p.isCancel(continueAnyway)) {
        throw new Error('API 키 검증 실패');
      }
    }

    // 모델 선택
    const model = await this.selectModel(provider);

    return { provider, apiKey, model };
  }

  /**
   * API 키 검증
   */
  private async validateApiKey(provider: LLMProvider, apiKey: string): Promise<boolean> {
    try {
      if (provider === 'anthropic') {
        const { AnthropicClient } = await import('../../llm/anthropic.js');
        const client = new AnthropicClient(apiKey);
        return await client.validateKey();
      } else {
        const { OpenAIClient } = await import('../../llm/openai.js');
        const client = new OpenAIClient(apiKey);
        return await client.validateKey();
      }
    } catch {
      return false;
    }
  }

  /**
   * 모델 선택
   */
  private async selectModel(provider: LLMProvider): Promise<string> {
    const models =
      provider === 'anthropic'
        ? [
            { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus', hint: '가장 강력한 모델' },
            { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet', hint: '권장' },
            { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', hint: '빠른 응답' },
          ]
        : [
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', hint: '가장 강력한 모델' },
            { value: 'gpt-4', label: 'GPT-4', hint: '권장' },
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', hint: '빠른 응답' },
          ];

    const model = await p.select({
      message: '사용할 모델을 선택하세요:',
      options: models,
    });

    if (p.isCancel(model)) {
      return provider === 'anthropic' ? 'claude-3-sonnet-20240229' : 'gpt-4';
    }

    return model;
  }

  /**
   * 채널 설정 (선택)
   */
  private async setupChannels(): Promise<{
    telegram?: { botToken: string };
    slack?: { appToken: string; botToken: string };
  }> {
    p.log.step('📱 채널 설정 (선택사항)');

    const channels: {
      telegram?: { botToken: string };
      slack?: { appToken: string; botToken: string };
    } = {};

    // Telegram 설정
    const setupTelegram = await p.confirm({
      message: 'Telegram 봇을 설정하시겠습니까?',
      initialValue: false,
    });

    if (!p.isCancel(setupTelegram) && setupTelegram) {
      const botToken = await p.password({
        message: 'Telegram Bot Token을 입력하세요:',
        validate: (value) => {
          if (!value || !value.includes(':')) {
            return '유효한 Bot Token을 입력하세요 (예: 123456:ABC-DEF...)'
          }
        },
      });

      if (!p.isCancel(botToken)) {
        channels.telegram = { botToken };
        p.log.success('Telegram 설정이 완료되었습니다.');
      }
    }

    // Slack 설정
    const setupSlack = await p.confirm({
      message: 'Slack 앱을 설정하시겠습니까?',
      initialValue: false,
    });

    if (!p.isCancel(setupSlack) && setupSlack) {
      const appToken = await p.password({
        message: 'Slack App Token을 입력하세요 (xapp-로 시작):',
        validate: (value) => {
          if (!value || !value.startsWith('xapp-')) {
            return '유효한 App Token을 입력하세요'
          }
        },
      });

      if (!p.isCancel(appToken)) {
        const botToken = await p.password({
          message: 'Slack Bot Token을 입력하세요 (xoxb-로 시작):',
          validate: (value) => {
            if (!value || !value.startsWith('xoxb-')) {
              return '유효한 Bot Token을 입력하세요'
            }
          },
        });

        if (!p.isCancel(botToken)) {
          channels.slack = { appToken, botToken };
          p.log.success('Slack 설정이 완료되었습니다.');
        }
      }
    }

    return channels;
  }

  /**
   * 설정 파일 생성
   */
  private createConfig(
    llmConfig: { provider: LLMProvider; apiKey: string; model: string },
    channelConfig: {
      telegram?: { botToken: string };
      slack?: { appToken: string; botToken: string };
    }
  ): AppConfig {
    return {
      version: '2',
      llm: {
        defaultProvider: llmConfig.provider,
        defaultModel: llmConfig.model,
        maxTokens: 4096,
        temperature: 0.7,
      },
      channels: {
        enabled: !!(channelConfig.telegram || channelConfig.slack),
        telegram: channelConfig.telegram
          ? {
              botToken: channelConfig.telegram.botToken,
              allowedUsers: [],
            }
          : undefined,
        slack: channelConfig.slack
          ? {
              appToken: channelConfig.slack.appToken,
              botToken: channelConfig.slack.botToken,
              allowedUsers: [],
            }
          : undefined,
      },
      gateway: {
        httpPort: 8080,
        wsPort: 8081,
        host: '127.0.0.1',
        cors: {
          origins: ['http://localhost:3000'],
        },
        auth: {
          jwtSecret: this.generateRandomString(32),
          tokenExpiry: 3600,
        },
      },
      logging: {
        level: 'info',
        console: true,
        file: {
          enabled: true,
          path: join(DEFAULT_CONFIG_DIR, 'logs', 'app.log'),
          maxSize: '10m',
          maxFiles: 5,
        },
        json: true,
      },
      memory: {
        dbPath: join(DEFAULT_CONFIG_DIR, 'memory.db'),
        maxContextLength: 10,
        sessionExpiry: 7 * 24 * 60 * 60 * 1000,
      },
      security: {
        approvalMode: 'interactive',
        whitelistedTools: [],
        timeouts: {
          low: 30,
          medium: 60,
          high: 120,
          critical: 120,
        },
      },
    };
  }

  /**
   * 마스터 키 저장
   */
  private async saveMasterKey(hash: string): Promise<void> {
    const { writeFileSync, mkdirSync } = await import('fs');

    if (!existsSync(DEFAULT_CONFIG_DIR)) {
      mkdirSync(DEFAULT_CONFIG_DIR, { recursive: true });
    }

    writeFileSync(MASTER_KEY_FILE, hash, 'utf-8');
    p.log.success('마스터 키가 저장되었습니다.');
  }

  /**
   * Auth Profile 생성
   */
  private async createAuthProfile(
    masterKey: Buffer,
    llmConfig: { provider: LLMProvider; apiKey: string; model: string }
  ): Promise<void> {
    const profileManager = new AuthProfileManager();
    profileManager.setMasterKey(masterKey);

    profileManager.createProfile({
      name: `Default ${llmConfig.provider} Profile`,
      provider: llmConfig.provider,
      type: 'api_key',
      credentials: {
        type: 'api_key',
        apiKey: llmConfig.apiKey,
      },
      priority: 0,
      metadata: {
        model: llmConfig.model,
        onboard: true,
      },
    });

    p.log.success('LLM 프로파일이 생성되었습니다.');
  }

  /**
   * 기존 평문 자격 증명 마이그레이션 확인
   */
  private async checkPlaintextMigration(): Promise<void> {
    const envPaths = [
      join(process.cwd(), '.env'),
      join(homedir(), '.doppelgesicht', '.env'),
    ];

    const foundEnvFiles = envPaths.filter((path) => existsSync(path));

    if (foundEnvFiles.length === 0) {
      return;
    }

    p.log.step('📝 평문 자격 증명 마이그레이션');
    p.log.warn('기존 .env 파일에서 자격 증명을 발견했습니다.');

    const migrate = await p.confirm({
      message: '기존 자격 증명을 새 설정으로 마이그레이션하시겠습니까?',
      initialValue: true,
    });

    if (!p.isCancel(migrate) && migrate) {
      p.log.info('마이그레이션은 나중에 `doppelgesicht migrate` 명령어로 진행할 수 있습니다.');
    }
  }

  /**
   * 랜덤 문자열 생성
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

/**
 * 마스터 키 복구 (로그인용)
 */
export async function recoverMasterKey(): Promise<Buffer | null> {
  if (!existsSync(MASTER_KEY_FILE)) {
    return null;
  }

  const { readFileSync } = await import('fs');
  const storedHash = readFileSync(MASTER_KEY_FILE, 'utf-8');

  const password = await p.password({
    message: '마스터 비밀번호를 입력하세요:',
  });

  if (p.isCancel(password)) {
    return null;
  }

  return await verifyAndRecoverKey(password, storedHash);
}
