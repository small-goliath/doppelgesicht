/**
 * Discord 채널 모듈
 * @description discord.js 14.x 기반 Discord Bot 연동
 */

export type {
  DiscordConfig,
  DiscordIncomingMessage,
  DiscordOutgoingMessage,
  DiscordAttachment,
  DiscordEmbed,
  DiscordComponent,
  DiscordSelectOption,
  DiscordAdapterState,
  DiscordCommandInteraction,
  DiscordButtonInteraction,
} from './types.js';

export { DISCORD_CAPABILITIES } from './types.js';
export { DiscordAdapter } from './adapter.js';
