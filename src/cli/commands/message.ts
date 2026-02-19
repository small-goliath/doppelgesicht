/**
 * Message CLI 명령어
 * @description 메시지 전송 테스트 CLI 구현
 */

import { Command } from 'commander';
import * as p from '@clack/prompts';
import { pc } from '../../utils/colors.js';
import { ConfigManager } from '../../core/config-manager.js';
import { createLogger } from '../../logging/index.js';
import { TelegramAdapter } from '../../channels/telegram/adapter.js';
import { SlackAdapter } from '../../channels/slack/adapter.js';
import { DiscordAdapter } from '../../channels/discord/adapter.js';
import type { IChannelAdapter, OutgoingMessage } from '../../channels/types.js';
import { join } from 'path';
import { homedir } from 'os';

// 기본 설정 경로
const DEFAULT_CONFIG_DIR = join(homedir(), '.doppelgesicht');
const DEFAULT_CONFIG_PATH = join(DEFAULT_CONFIG_DIR, 'config.yaml');

/**
 * Message 명령어 등록
 */
export function registerMessageCommand(program: Command): void {
  const messageCmd = program
    .command('message')
    .description('메시지 전송 및 채널 관리');

  // send 서브커맨드
  messageCmd
    .command('send')
    .description('메시지를 전송합니다')
    .requiredOption('-c, --channel <channelId>', '채널 ID (telegram, slack, discord)')
    .requiredOption('-t, --text <text>', '전송할 메시지')
    .option('-r, --recipient <recipientId>', '수신자 ID (사용자 ID 또는 채널 ID)')
    .option('--config <path>', '설정 파일 경로', DEFAULT_CONFIG_PATH)
    .action(async (options) => {
      const messageCLI = new MessageCLI(options);
      await messageCLI.send();
    });

  // list 서브커맨드
  messageCmd
    .command('list')
    .description('연결된 채널 목록을 조회합니다')
    .option('--config <path>', '설정 파일 경로', DEFAULT_CONFIG_PATH)
    .action(async (options) => {
      const messageCLI = new MessageCLI(options);
      await messageCLI.list();
    });

  // test 서브커맨드
  messageCmd
    .command('test')
    .description('채널 연결을 테스트합니다')
    .requiredOption('-c, --channel <channelId>', '채널 ID (telegram, slack, discord)')
    .option('--config <path>', '설정 파일 경로', DEFAULT_CONFIG_PATH)
    .action(async (options) => {
      const messageCLI = new MessageCLI(options);
      await messageCLI.test();
    });
}

/**
 * Message CLI 클래스
 */
class MessageCLI {
  private options: {
    channel?: string;
    text?: string;
    recipient?: string;
    config: string;
  };
  private logger = createLogger({ level: 'info', console: true, json: false });
  private channels: Map<string, IChannelAdapter> = new Map();

  constructor(options: {
    channel?: string;
    text?: string;
    recipient?: string;
    config: string;
  }) {
    this.options = options;
  }

  /**
   * 메시지 전송
   */
  async send(): Promise<void> {
    console.clear();
    p.intro(pc.cyan('📨 메시지 전송'));

    try {
      // 1. 설정 로드 및 채널 초기화
      const initialized = await this.initializeChannels();
      if (!initialized) {
        return;
      }

      // 2. 채널 확인
      const channelId = this.options.channel!;
      const channel = this.channels.get(channelId);

      if (!channel) {
        p.log.error(`채널을 찾을 수 없습니다: ${channelId}`);
        this.showChannelSetupGuide(channelId);
        process.exit(1);
      }

      // 3. 채널 연결 상태 확인
      if (!channel.isConnected()) {
        p.log.error(`채널이 연결되지 않았습니다: ${channelId}`);
        this.showChannelSetupGuide(channelId);
        process.exit(1);
      }

      // 4. 수신자 확인
      let recipientId = this.options.recipient;
      if (!recipientId) {
        recipientId = await this.promptForRecipient(channelId);
        if (!recipientId) {
          p.outro(pc.yellow('전송이 취소되었습니다.'));
          process.exit(0);
        }
      }

      // 5. 메시지 전송
      const spinner = p.spinner();
      spinner.start('메시지를 전송하는 중...');

      const message: OutgoingMessage = {
        text: this.options.text!,
      };

      await channel.send(recipientId, message);

      spinner.stop('메시지가 전송되었습니다.');
      p.outro(pc.green('✅ 전송 완료'));

      // 6. 채널 정리
      await this.cleanup();
      process.exit(0);
    } catch (error) {
      this.logger.error('Message send failed', { error: (error as Error).message });
      p.outro(pc.red('전송 중 오류가 발생했습니다.'));
      process.exit(1);
    }
  }

  /**
   * 채널 목록 조회
   */
  async list(): Promise<void> {
    console.clear();
    p.intro(pc.cyan('📱 채널 목록'));

    try {
      // 1. 설정 로드
      const configManager = new ConfigManager(this.options.config);
      if (!configManager.exists()) {
        p.log.error('설정 파일을 찾을 수 없습니다.');
        p.log.info(pc.dim('`doppelgesicht onboard`를 실행하여 설정을 생성하세요.'));
        process.exit(1);
      }

      const config = configManager.load();

      // 2. 채널 정보 표시
      console.log();
      console.log(pc.cyan('설정된 채널:'));

      const channels: Array<{ id: string; name: string; enabled: boolean; configured: boolean }> = [];

      // Telegram
      const telegramConfigured = !!config.channels.telegram?.botToken;
      channels.push({
        id: 'telegram',
        name: 'Telegram',
        enabled: config.channels.enabled && telegramConfigured,
        configured: telegramConfigured,
      });

      // Slack
      const slackConfigured = !!(config.channels.slack?.appToken && config.channels.slack?.botToken);
      channels.push({
        id: 'slack',
        name: 'Slack',
        enabled: config.channels.enabled && slackConfigured,
        configured: slackConfigured,
      });

      // Discord
      const discordConfigured = !!config.channels.discord?.botToken;
      channels.push({
        id: 'discord',
        name: 'Discord',
        enabled: config.channels.enabled && discordConfigured,
        configured: discordConfigured,
      });

      for (const channel of channels) {
        const statusIcon = channel.enabled
          ? pc.green('●')
          : channel.configured
          ? pc.yellow('○')
          : pc.red('○');
        const statusText = channel.enabled
          ? pc.green('활성')
          : channel.configured
          ? pc.yellow('비활성')
          : pc.red('미설정');

        console.log(`  ${statusIcon} ${pc.bold(channel.name)} (${channel.id})`);
        console.log(`    상태: ${statusText}`);

        if (!channel.configured) {
          console.log(`    ${pc.dim('설정: ~/.doppelgesicht/config.yaml')}`);
        }
      }

      console.log();
      p.log.info(pc.dim('채널 연결 테스트: doppelgesicht message test -c <channelId>'));

      p.outro(pc.green('조회 완료'));
      process.exit(0);
    } catch (error) {
      this.logger.error('Channel list failed', { error: (error as Error).message });
      p.outro(pc.red('조회 중 오류가 발생했습니다.'));
      process.exit(1);
    }
  }

  /**
   * 채널 연결 테스트
   */
  async test(): Promise<void> {
    console.clear();
    p.intro(pc.cyan('🔌 채널 연결 테스트'));

    try {
      // 1. 설정 로드 및 채널 초기화
      const initialized = await this.initializeChannels();
      if (!initialized) {
        return;
      }

      // 2. 채널 확인
      const channelId = this.options.channel!;
      const channel = this.channels.get(channelId);

      if (!channel) {
        p.log.error(`채널을 찾을 수 없습니다: ${channelId}`);
        this.showChannelSetupGuide(channelId);
        process.exit(1);
      }

      // 3. 연결 테스트
      const spinner = p.spinner();
      spinner.start(`${channel.name} 채널 연결 테스트 중...`);

      try {
        // 이미 initializeChannels에서 start()가 호출되었으므로
        // 여기서는 단순히 연결 상태만 확인
        if (channel.isConnected()) {
          spinner.stop(`${channel.name} 채널이 정상적으로 연결되었습니다.`);
          p.outro(pc.green('✅ 연결 테스트 성공'));
        } else {
          spinner.stop(`${channel.name} 채널 연결에 실패했습니다.`);
          p.outro(pc.red('❌ 연결 테스트 실패'));
          process.exit(1);
        }
      } catch (error) {
        spinner.stop(`연결 테스트 중 오류 발생: ${(error as Error).message}`);
        p.outro(pc.red('❌ 연결 테스트 실패'));
        process.exit(1);
      }

      // 4. 채널 정리
      await this.cleanup();
      process.exit(0);
    } catch (error) {
      this.logger.error('Channel test failed', { error: (error as Error).message });
      p.outro(pc.red('테스트 중 오류가 발생했습니다.'));
      process.exit(1);
    }
  }

  /**
   * 채널 초기화
   */
  private async initializeChannels(): Promise<boolean> {
    const spinner = p.spinner();
    spinner.start('설정을 로드하는 중...');

    try {
      const configManager = new ConfigManager(this.options.config);
      if (!configManager.exists()) {
        spinner.stop('설정 파일을 찾을 수 없습니다.');
        p.log.error('설정 파일이 존재하지 않습니다.');
        p.log.info(pc.dim('`doppelgesicht onboard`를 실행하여 설정을 생성하세요.'));
        return false;
      }

      const config = configManager.load();
      spinner.stop('설정이 로드되었습니다.');

      // Telegram 채널 초기화
      if (config.channels.telegram?.botToken) {
        try {
          const telegramAdapter = new TelegramAdapter(
            {
              id: 'telegram',
              name: 'Telegram',
              enabled: true,
              botToken: config.channels.telegram.botToken,
              allowedUsers: config.channels.telegram.allowedUsers || [],
            } as import('../../channels/types.js').ChannelConfig,
            this.logger
          );
          await telegramAdapter.start();
          this.channels.set('telegram', telegramAdapter);
          p.log.success('Telegram 채널이 초기화되었습니다.');
        } catch (error) {
          p.log.warn(`Telegram 채널 초기화 실패: ${(error as Error).message}`);
        }
      }

      // Slack 채널 초기화
      if (config.channels.slack?.appToken && config.channels.slack?.botToken) {
        try {
          const slackAdapter = new SlackAdapter(
            {
              id: 'slack',
              name: 'Slack',
              enabled: true,
              appToken: config.channels.slack.appToken,
              botToken: config.channels.slack.botToken,
              allowedUsers: config.channels.slack.allowedUsers || [],
            } as import('../../channels/types.js').ChannelConfig,
            this.logger
          );
          await slackAdapter.start();
          this.channels.set('slack', slackAdapter);
          p.log.success('Slack 채널이 초기화되었습니다.');
        } catch (error) {
          p.log.warn(`Slack 채널 초기화 실패: ${(error as Error).message}`);
        }
      }

      // Discord 채널 초기화
      if (config.channels.discord?.botToken) {
        try {
          const discordAdapter = new DiscordAdapter(
            {
              id: 'discord',
              name: 'Discord',
              enabled: true,
              botToken: config.channels.discord.botToken,
              allowedUsers: config.channels.discord.allowedUsers || [],
              allowedChannels: config.channels.discord.allowedChannels || [],
              allowedGuilds: config.channels.discord.allowedGuilds || [],
              allowDMs: config.channels.discord.allowDMs ?? true,
            } as import('../../channels/types.js').ChannelConfig,
            this.logger
          );
          await discordAdapter.start();
          this.channels.set('discord', discordAdapter);
          p.log.success('Discord 채널이 초기화되었습니다.');
        } catch (error) {
          p.log.warn(`Discord 채널 초기화 실패: ${(error as Error).message}`);
        }
      }

      if (this.channels.size === 0) {
        p.log.warn('활성화된 채널이 없습니다.');
        p.log.info(pc.dim('`doppelgesicht onboard`를 실행하여 채널을 설정하세요.'));
        return false;
      }

      return true;
    } catch (error) {
      spinner.stop(`초기화 실패: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 수신자 입력 프롬프트
   */
  private async promptForRecipient(channelId: string): Promise<string | null> {
    const channel = this.channels.get(channelId);
    if (!channel) return null;

    const placeholder =
      channelId === 'telegram'
        ? '123456789'
        : channelId === 'slack'
          ? 'C1234567890'
          : '1234567890123456789';

    const recipient = await p.text({
      message: `${channel.name} 수신자 ID를 입력하세요:`,
      placeholder,
    });

    if (p.isCancel(recipient)) {
      return null;
    }

    return recipient;
  }

  /**
   * 채널 설정 가이드 표시
   */
  private showChannelSetupGuide(channelId: string): void {
    console.log();

    let configExample = '';
    if (channelId === 'telegram') {
      configExample =
        `   ${pc.dim('channels:')}\n` +
        `   ${pc.dim('  telegram:')}\n` +
        `   ${pc.dim('    botToken: "YOUR_BOT_TOKEN"')}`;
    } else if (channelId === 'slack') {
      configExample =
        `   ${pc.dim('channels:')}\n` +
        `   ${pc.dim('  slack:')}\n` +
        `   ${pc.dim('    appToken: "xapp-..."')}\n` +
        `   ${pc.dim('    botToken: "xoxb-..."')}`;
    } else if (channelId === 'discord') {
      configExample =
        `   ${pc.dim('channels:')}\n` +
        `   ${pc.dim('  discord:')}\n` +
        `   ${pc.dim('    botToken: "YOUR_BOT_TOKEN"')}`;
    }

    p.note(
      `${pc.cyan('채널 설정 방법:')}\n\n` +
      `1. 설정 파일 열기:\n` +
      `   ${pc.dim('~/.doppelgesicht/config.yaml')}\n\n` +
      `2. ${channelId} 설정 추가:\n` +
      configExample +
      `\n\n3. 설정 후 다시 시도하세요.`,
      '설정 안내'
    );
  }

  /**
   * 채널 정리
   */
  private async cleanup(): Promise<void> {
    for (const [id, channel] of this.channels) {
      try {
        await channel.stop();
        this.logger.debug(`Channel stopped: ${id}`);
      } catch (error) {
        this.logger.warn(`Failed to stop channel ${id}`, { error: (error as Error).message });
      }
    }
    this.channels.clear();
  }
}