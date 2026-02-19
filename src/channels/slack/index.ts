/**
 * Slack 채널 모듈
 * @description @slack/bolt 4.6.0, @slack/web-api 7.14.0 기반
 */

export type {
  SlackConfig,
  SlackIncomingMessage,
  SlackOutgoingMessage,
  SlackFile,
  SlackAttachment,
  SlackAdapterState,
} from './types.js';

export { SLACK_CAPABILITIES } from './types.js';
export { SlackAdapter } from './adapter.js';
