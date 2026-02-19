/**
 * 채널 모듈
 * @description 다양한 메신저 채널(Telegram, Slack 등) 통합
 */

export type {
  ChannelCapabilities,
  IncomingMessage,
  OutgoingMessage,
  MessageAttachment,
  ChannelConfig,
  IChannelAdapter,
  ChannelRegistry,
} from './types.js';

export * as telegram from './telegram/index.js';
export * as slack from './slack/index.js';
