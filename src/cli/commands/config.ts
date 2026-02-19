/**
 * Config CLI 명령어
 * @description 설정 관리 명령어 구현
 */

import type { Command } from 'commander';
import * as p from '@clack/prompts';
import { pc } from '../../utils/colors.js';
import { getConfigManager } from '../../core/config-manager.js';

/**
 * 설정값을 문자열로 변환합니다
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * 객체에서 중첩된 값을 가져옵니다
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * 객체에 중첩된 값을 설정합니다
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  // 값 파싱 (숫자, boolean, 객체 등)
  const finalKey = keys[keys.length - 1];
  current[finalKey] = parseValue(value as string);
}

/**
 * 문자열 값을 적절한 타입으로 파싱합니다
 */
function parseValue(value: string): unknown {
  // Boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // Null
  if (value.toLowerCase() === 'null') return null;

  // Number
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

  // JSON Object/Array
  if ((value.startsWith('{') && value.endsWith('}')) ||
      (value.startsWith('[') && value.endsWith(']'))) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // String
  return value;
}

/**
 * 환경변수 참조를 해석합니다
 */
function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, content) => {
    const [varName, defaultValue] = content.split(':');
    const envValue = process.env[varName];
    return envValue !== undefined ? envValue : (defaultValue || match);
  });
}

/**
 * 설정값을 환경변수와 함께 표시합니다
 */
function displayValue(key: string, value: unknown, showRaw = false): void {
  const formatted = formatValue(value);

  if (showRaw && typeof value === 'string' && value.includes('${')) {
    const resolved = resolveEnvVars(value);
    if (resolved !== value) {
      p.log.info(`${pc.cyan(key)}: ${pc.dim(formatted)}`);
      p.log.info(`  ${pc.green('→')} ${pc.yellow(resolved)}`);
      return;
    }
  }

  p.log.info(`${pc.cyan(key)}: ${pc.yellow(formatted)}`);
}

/**
 * config get 명령어 핸들러
 */
async function handleConfigGet(key?: string, options: { raw?: boolean } = {}): Promise<void> {
  const spinner = p.spinner();
  spinner.start('설정을 로드하는 중...');

  try {
    const configManager = getConfigManager();

    if (!configManager.exists()) {
      spinner.stop('설정 파일이 없습니다.');
      p.log.error('설정 파일을 찾을 수 없습니다. `doppelgesicht onboard`를 실행하세요.');
      process.exit(1);
    }

    const config = configManager.load();
    spinner.stop('설정 로드 완료');

    if (key) {
      // 특정 키 조회
      const value = getNestedValue(config as Record<string, unknown>, key);

      if (value === undefined) {
        p.log.error(`설정 키를 찾을 수 없습니다: ${key}`);
        process.exit(1);
      }

      displayValue(key, value, options.raw);
    } else {
      // 전체 설정 조회
      p.log.success(pc.cyan('전체 설정:'));
      console.log();
      console.log(formatValue(config));
    }
  } catch (error) {
    spinner.stop('설정 로드 실패');
    p.log.error(`오류: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * config set 명령어 핸들러
 */
async function handleConfigSet(key: string, value: string): Promise<void> {
  const spinner = p.spinner();
  spinner.start('설정을 업데이트하는 중...');

  try {
    const configManager = getConfigManager();

    if (!configManager.exists()) {
      spinner.stop('설정 파일이 없습니다.');
      p.log.error('설정 파일을 찾을 수 없습니다. `doppelgesicht onboard`를 실행하세요.');
      process.exit(1);
    }

    const config = configManager.load();

    // 값 설정
    setNestedValue(config as Record<string, unknown>, key, value);

    // 저장
    configManager.save(config);

    spinner.stop('설정 업데이트 완료');

    const newValue = getNestedValue(config as Record<string, unknown>, key);
    p.log.success(`${pc.cyan(key)}가 업데이트되었습니다:`);
    displayValue('새 값', newValue);
  } catch (error) {
    spinner.stop('설정 업데이트 실패');
    p.log.error(`오류: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * config validate 명령어 핸들러
 */
async function handleConfigValidate(): Promise<void> {
  const spinner = p.spinner();
  spinner.start('설정을 검증하는 중...');

  try {
    const configManager = getConfigManager();

    if (!configManager.exists()) {
      spinner.stop('설정 파일이 없습니다.');
      p.log.error('설정 파일을 찾을 수 없습니다. `doppelgesicht onboard`를 실행하세요.');
      process.exit(1);
    }

    const config = configManager.load();
    const result = configManager.validate(config);

    spinner.stop('설정 검증 완료');

    if (result.valid) {
      p.log.success(pc.green('✓ 설정이 유효합니다.'));
    } else {
      p.log.error(pc.red('✗ 설정에 오류가 있습니다:'));
      for (const error of result.errors) {
        p.log.error(`  • ${error}`);
      }
      process.exit(1);
    }

    // 환경변수 참조 확인
    const envVars = findEnvVarReferences(config);
    if (envVars.length > 0) {
      console.log();
      p.log.info(pc.cyan('환경변수 참조:'));
      for (const { path, value, resolved } of envVars) {
        const status = resolved !== value ? pc.green('✓') : pc.red('✗ (미설정)');
        p.log.info(`  ${status} ${pc.dim(path)}: ${pc.yellow(value)}`);
        if (resolved !== value) {
          p.log.info(`     → ${pc.green(resolved)}`);
        }
      }
    }
  } catch (error) {
    spinner.stop('설정 검증 실패');
    p.log.error(`오류: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * 설정에서 모든 환경변수 참조를 찾습니다
 */
function findEnvVarReferences(
  obj: unknown,
  path = ''
): Array<{ path: string; value: string; resolved: string }> {
  const results: Array<{ path: string; value: string; resolved: string }> = [];

  if (typeof obj === 'string' && obj.includes('${')) {
    results.push({
      path: path || 'root',
      value: obj,
      resolved: resolveEnvVars(obj),
    });
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      results.push(...findEnvVarReferences(obj[i], `${path}[${i}]`));
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;
      results.push(...findEnvVarReferences(value, newPath));
    }
  }

  return results;
}

/**
 * config edit 명령어 핸들러 (대화형)
 */
async function handleConfigEdit(): Promise<void> {
  p.intro(pc.cyan('🔧 설정 편집기'));

  const configManager = getConfigManager();

  if (!configManager.exists()) {
    p.log.error('설정 파일을 찾을 수 없습니다. `doppelgesicht onboard`를 실행하세요.');
    process.exit(1);
  }

  const config = configManager.load();

  const action = await p.select({
    message: '어떤 작업을 수행하시겠습니까?',
    options: [
      { value: 'llm', label: 'LLM 설정' },
      { value: 'gateway', label: 'Gateway 설정' },
      { value: 'channels', label: '채널 설정' },
      { value: 'logging', label: '로깅 설정' },
      { value: 'security', label: '보안 설정' },
      { value: 'cancel', label: '취소' },
    ],
  });

  if (p.isCancel(action) || action === 'cancel') {
    p.outro('편집이 취소되었습니다.');
    return;
  }

  // 각 섹션별 편집 로직
  switch (action) {
    case 'llm': {
      const provider = await p.select({
        message: '기본 제공자를 선택하세요:',
        options: [
          { value: 'anthropic', label: 'Anthropic (Claude)' },
          { value: 'openai', label: 'OpenAI (GPT)' },
        ],
      });

      if (!p.isCancel(provider)) {
        setNestedValue(config as Record<string, unknown>, 'llm.defaultProvider', provider as string);
      }

      const model = await p.text({
        message: '기본 모델을 입력하세요:',
        initialValue: config.llm.defaultModel,
      });

      if (!p.isCancel(model)) {
        setNestedValue(config as Record<string, unknown>, 'llm.defaultModel', model as string);
      }

      const maxTokens = await p.text({
        message: '최대 토큰 수:',
        initialValue: String(config.llm.maxTokens),
        validate: (value) => {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 1 || num > 8192) {
            return '1에서 8192 사이의 숫자를 입력하세요.';
          }
        },
      });

      if (!p.isCancel(maxTokens)) {
        setNestedValue(config as Record<string, unknown>, 'llm.maxTokens', maxTokens as string);
      }
      break;
    }

    case 'gateway': {
      const host = await p.text({
        message: 'Gateway 호스트:',
        initialValue: config.gateway.host,
      });

      if (!p.isCancel(host)) {
        setNestedValue(config as Record<string, unknown>, 'gateway.host', host as string);
      }

      const httpPort = await p.text({
        message: 'HTTP 포트:',
        initialValue: String(config.gateway.httpPort),
        validate: (value) => {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 1 || num > 65535) {
            return '1에서 65535 사이의 포트를 입력하세요.';
          }
        },
      });

      if (!p.isCancel(httpPort)) {
        setNestedValue(config as Record<string, unknown>, 'gateway.httpPort', httpPort as string);
      }
      break;
    }

    case 'channels': {
      const enabled = await p.confirm({
        message: '채널 기능을 활성화하시겠습니까?',
        initialValue: config.channels.enabled,
      });

      if (!p.isCancel(enabled)) {
        setNestedValue(config as Record<string, unknown>, 'channels.enabled', String(enabled));
      }
      break;
    }

    case 'logging': {
      const level = await p.select({
        message: '로그 레벨을 선택하세요:',
        options: [
          { value: 'debug', label: 'Debug' },
          { value: 'info', label: 'Info' },
          { value: 'warn', label: 'Warn' },
          { value: 'error', label: 'Error' },
        ],
      });

      if (!p.isCancel(level)) {
        setNestedValue(config as Record<string, unknown>, 'logging.level', level as string);
      }

      const console = await p.confirm({
        message: '콘솔 로깅을 활성화하시겠습니까?',
        initialValue: config.logging.console,
      });

      if (!p.isCancel(console)) {
        setNestedValue(config as Record<string, unknown>, 'logging.console', String(console));
      }
      break;
    }

    case 'security': {
      const mode = await p.select({
        message: '승인 모드를 선택하세요:',
        options: [
          { value: 'interactive', label: 'Interactive (대화형 승인)' },
          { value: 'whitelist', label: 'Whitelist (화이트리스트 기반)' },
        ],
      });

      if (!p.isCancel(mode)) {
        setNestedValue(config as Record<string, unknown>, 'security.approvalMode', mode as string);
      }
      break;
    }
  }

  // 변경사항 저장
  const shouldSave = await p.confirm({
    message: '변경사항을 저장하시겠습니까?',
    initialValue: true,
  });

  if (shouldSave && !p.isCancel(shouldSave)) {
    configManager.save(config as unknown as import('../../types/config.js').AppConfig);
    p.outro(pc.green('설정이 저장되었습니다.'));
    return;
  } else {
    p.outro('변경사항이 취소되었습니다.');
    return;
  }
}

/**
 * Commander 명령어 등록
 */
export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Manage configuration settings');

  configCmd
    .command('get [key]')
    .description('Get configuration value')
    .option('-r, --raw', 'Show raw values including environment variable references')
    .action(handleConfigGet);

  configCmd
    .command('set <key> <value>')
    .description('Set configuration value')
    .action(handleConfigSet);

  configCmd
    .command('validate')
    .description('Validate configuration file')
    .action(handleConfigValidate);

  configCmd
    .command('edit')
    .description('Edit configuration interactively')
    .action(handleConfigEdit);
}
