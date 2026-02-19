/**
 * Telegram 채널 모듈
 * @description grammy 1.40.0 기반 Telegram Bot 연동
 */

export type {
  TelegramConfig,
  TelegramIncomingMessage,
  TelegramOutgoingMessage,
  TelegramInlineKeyboard,
  TelegramInlineKeyboardButton,
  TelegramAdapterState,
} from './types.js';

export { TELEGRAM_CAPABILITIES } from './types.js';
export { TelegramAdapter } from './adapter.js';
