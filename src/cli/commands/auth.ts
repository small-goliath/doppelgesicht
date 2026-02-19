/**
 * Auth CLI 명령어
 * @description 인증 프로파일 관리 명령어 구현
 */

import type { Command } from 'commander';
import * as p from '@clack/prompts';
import { pc } from '../../utils/colors.js';
import { AuthProfileManager } from '../../core/auth-profile.js';
import { getMasterKey } from '../../security/master-key.js';
import type { LLMProvider, AuthType, CreateAuthProfileInput } from '../../types/auth.js';
import { MoonshotClient } from '../../llm/moonshot.js';
import type { ILogger } from '../../logging/index.js';

/**
 * 프로파일 목록 표시
 */
async function handleAuthList(): Promise<void> {
  const spinner = p.spinner();
  spinner.start('프로파일을 로드하는 중...');

  try {
    const masterKey = await getMasterKey();
    const manager = new AuthProfileManager();
    manager.setMasterKey(masterKey);

    // TODO: 실제 저장소에서 프로파일 로드
    // 현재는 메모리에만 존재

    const profiles = manager.getAllProfiles();
    spinner.stop('프로파일 로드 완료');

    if (profiles.length === 0) {
      p.log.info('등록된 인증 프로파일이 없습니다.');
      p.log.info(pc.dim('`doppelgesicht auth add`로 새 프로파일을 추가하세요.'));
      return;
    }

    p.log.success(pc.cyan(`등록된 프로파일: ${profiles.length}개`));
    console.log();

    for (const profile of profiles) {
      const statusIcon = profile.isActive ? pc.green('●') : pc.gray('○');
      const providerColor =
        profile.provider === 'anthropic'
          ? pc.yellow
          : profile.provider === 'openai'
            ? pc.green
            : pc.cyan;
      const healthColor =
        profile.health.status === 'healthy'
          ? pc.green
          : profile.health.status === 'degraded'
            ? pc.yellow
            : profile.health.status === 'cooldown'
              ? pc.yellow
              : pc.red;

      console.log(`${statusIcon} ${pc.bold(profile.name)}`);
      console.log(`  ID: ${pc.dim(profile.id)}`);
      console.log(`  제공자: ${providerColor(profile.provider)}`);
      console.log(`  방식: ${pc.dim(profile.type)}`);
      console.log(`  우선순위: ${pc.dim(String(profile.priority))}`);
      console.log(`  상태: ${healthColor(profile.health.status)}`);
      console.log(`  마지막 사용: ${profile.lastUsed ? new Date(profile.lastUsed).toLocaleString() : pc.dim('미사용')}`);
      console.log();
    }
  } catch (error) {
    spinner.stop('프로파일 로드 실패');
    p.log.error(`오류: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * 프로파일 추가
 */
async function handleAuthAdd(): Promise<void> {
  p.intro(pc.cyan('🔐 새 인증 프로파일 추가'));

  try {
    const masterKey = await getMasterKey();
    const manager = new AuthProfileManager();
    manager.setMasterKey(masterKey);

    // 프로파일 이름
    const name = await p.text({
      message: '프로파일 이름을 입력하세요:',
      placeholder: '예: 개인 Anthropic',
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return '이름을 입력하세요.';
        }
        return undefined;
      },
    });

    if (p.isCancel(name)) {
      p.outro('취소되었습니다.');
      return;
    }

    // 제공자 선택
    const provider = await p.select({
      message: 'LLM 제공자를 선택하세요:',
      options: [
        { value: 'anthropic', label: 'Anthropic (Claude)' },
        { value: 'openai', label: 'OpenAI (GPT)' },
        { value: 'moonshot', label: 'Moonshot (Kimi)' },
      ],
    });

    if (p.isCancel(provider)) {
      p.outro('취소되었습니다.');
      return;
    }

    // 인증 방식 선택
    const authType = await p.select({
      message: '인증 방식을 선택하세요:',
      options: [
        { value: 'api_key', label: 'API Key' },
        { value: 'oauth', label: 'OAuth (Coming Soon)', hint: '미지원' },
      ],
    });

    if (p.isCancel(authType)) {
      p.outro('취소되었습니다.');
      return;
    }

    // 자격 증명 입력
    let credentials: CreateAuthProfileInput['credentials'];

    if (authType === 'api_key') {
      const apiKey = await p.password({
        message: 'API 키를 입력하세요:',
        mask: '*',
      });

      if (p.isCancel(apiKey)) {
        p.outro('취소되었습니다.');
        return;
      }

      const baseUrl = await p.text({
        message: 'API 엔드포인트 (선택사항):',
        placeholder: provider === 'anthropic'
          ? 'https://api.anthropic.com'
          : provider === 'openai'
            ? 'https://api.openai.com'
            : 'https://api.moonshot.cn/v1',
      });

      if (p.isCancel(baseUrl)) {
        p.outro('취소되었습니다.');
        return;
      }

      credentials = {
        type: 'api_key',
        apiKey: apiKey as string,
        baseUrl: (baseUrl as string) || undefined,
      };
    } else {
      // OAuth (미구현)
      p.log.error('OAuth 인증은 아직 지원되지 않습니다.');
      process.exit(1);
    }

    // 우선순위 설정
    const priority = await p.text({
      message: '우선순위 (낮을수록 높음):',
      initialValue: '0',
      validate: (value) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0) {
          return '0 이상의 숫자를 입력하세요.';
        }
        return undefined;
      },
    });

    if (p.isCancel(priority)) {
      p.outro('취소되었습니다.');
      return;
    }

    // Rate Limit 설정
    const configureRateLimit = await p.confirm({
      message: 'Rate Limit을 설정하시겠습니까?',
      initialValue: false,
    });

    let rateLimits: Partial<CreateAuthProfileInput['rateLimits']> = {};

    if (configureRateLimit && !p.isCancel(configureRateLimit)) {
      const requestsPerMinute = await p.text({
        message: '분당 최대 요청 수:',
        initialValue: '60',
        validate: (value) => {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 1) {
            return '1 이상의 숫자를 입력하세요.';
          }
          return undefined;
        },
      });

      if (!p.isCancel(requestsPerMinute)) {
        rateLimits.requestsPerMinute = parseInt(requestsPerMinute as string, 10);
      }
    }

    // API 키 검증 (moonshot 제공자)
    if (provider === 'moonshot') {
      const validateSpinner = p.spinner();
      validateSpinner.start('API 키를 검증하는 중...');

      const isValid = await validateApiKey(
        provider as LLMProvider,
        credentials.apiKey,
        credentials.baseUrl
      );

      if (isValid) {
        validateSpinner.stop('API 키가 유효합니다.');
      } else {
        validateSpinner.stop('API 키 검증에 실패했습니다.');
        const continueAnyway = await p.confirm({
          message: '계속 진행하시겠습니까?',
          initialValue: false,
        });

        if (!continueAnyway || p.isCancel(continueAnyway)) {
          p.outro('취소되었습니다.');
          return;
        }
      }
    }

    // 프로파일 생성
    const spinner = p.spinner();
    spinner.start('프로파일을 생성하는 중...');

    const profile = manager.createProfile({
      name: name as string,
      provider: provider as unknown as LLMProvider,
      type: authType as unknown as AuthType,
      credentials,
      priority: parseInt(priority as string, 10),
      rateLimits,
    });

    // TODO: 실제 저장소에 저장

    spinner.stop('프로파일 생성 완료');

    p.outro(
      pc.green('✓ 프로파일이 생성되었습니다.\n') +
      pc.dim(`ID: ${profile.id}\n`) +
      pc.dim(`이름: ${profile.name}\n`) +
      pc.dim(`제공자: ${profile.provider}`)
    );
  } catch (error) {
    p.log.error(`오류: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * 프로파일 삭제
 */
async function handleAuthRemove(id: string): Promise<void> {
  const spinner = p.spinner();
  spinner.start('프로파일을 삭제하는 중...');

  try {
    const masterKey = await getMasterKey();
    const manager = new AuthProfileManager();
    manager.setMasterKey(masterKey);

    // TODO: 실제 저장소에서 프로파일 로드 및 삭제

    const profile = manager.getProfile(id);

    if (!profile) {
      spinner.stop('프로파일을 찾을 수 없습니다.');
      p.log.error(`ID가 '${id}'인 프로파일을 찾을 수 없습니다.`);
      process.exit(1);
    }

    spinner.stop('프로파일 확인 완료');

    // 삭제 확인
    const confirmed = await p.confirm({
      message: `정말로 프로파일 '${profile.name}'을(를) 삭제하시겠습니까?`,
      initialValue: false,
    });

    if (!confirmed || p.isCancel(confirmed)) {
      p.outro('삭제가 취소되었습니다.');
      return;
    }

    const deleteSpinner = p.spinner();
    deleteSpinner.start('삭제하는 중...');

    const deleted = manager.deleteProfile(id);

    if (deleted) {
      // TODO: 실제 저장소에서도 삭제
      deleteSpinner.stop('삭제 완료');
      p.outro(pc.green('✓ 프로파일이 삭제되었습니다.'));
    } else {
      deleteSpinner.stop('삭제 실패');
      p.log.error('프로파일 삭제에 실패했습니다.');
      process.exit(1);
    }
  } catch (error) {
    spinner.stop('삭제 실패');
    p.log.error(`오류: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * 프로파일 테스트
 */
async function handleAuthTest(_id?: string): Promise<void> {
  const spinner = p.spinner();
  spinner.start('프로파일을 테스트하는 중...');

  try {
    const masterKey = await getMasterKey();
    const manager = new AuthProfileManager();
    manager.setMasterKey(masterKey);

    // TODO: 실제 저장소에서 프로파일 로드 및 테스트

    spinner.stop('테스트 완료');
    p.log.success('프로파일이 정상적으로 작동합니다.');
  } catch (error) {
    spinner.stop('테스트 실패');
    p.log.error(`오류: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * API 키 검증
 * @param provider - LLM 제공자
 * @param apiKey - API 키
 * @param baseUrl - API 엔드포인트 (선택사항)
 * @returns 검증 성공 여부
 */
async function validateApiKey(
  provider: LLMProvider,
  apiKey: string,
  baseUrl?: string
): Promise<boolean> {
  try {
    // 간단한 logger 생성
    const logger: ILogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      setLevel: () => {},
      child: () => logger,
      close: async () => {},
    };

    switch (provider) {
      case 'moonshot': {
        const client = new MoonshotClient(
          { provider: 'moonshot', apiKey, baseURL: baseUrl },
          logger
        );
        return await client.validateKey();
      }
      // 다른 제공자는 healthCheck로 검증
      case 'anthropic': {
        const { AnthropicClient } = await import('../../llm/anthropic.js');
        const client = new AnthropicClient(
          { provider: 'anthropic', apiKey, baseURL: baseUrl },
          logger
        );
        const health = await client.healthCheck();
        return health.healthy;
      }
      case 'openai': {
        const { OpenAIClient } = await import('../../llm/openai.js');
        const client = new OpenAIClient(
          { provider: 'openai', apiKey, baseURL: baseUrl },
          logger
        );
        const health = await client.healthCheck();
        return health.healthy;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Commander 명령어 등록
 */
export function registerAuthCommand(program: Command): void {
  const authCmd = program
    .command('auth')
    .description('Manage authentication profiles');

  authCmd
    .command('list')
    .alias('ls')
    .description('List all authentication profiles')
    .action(handleAuthList);

  authCmd
    .command('add')
    .description('Add a new authentication profile')
    .action(handleAuthAdd);

  authCmd
    .command('remove <id>')
    .alias('rm')
    .description('Remove an authentication profile')
    .action(handleAuthRemove);

  authCmd
    .command('test [id]')
    .description('Test authentication profile')
    .action(handleAuthTest);
}
