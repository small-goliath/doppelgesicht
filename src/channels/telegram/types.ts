/**
 * Telegram 채널 타입 정의
 * @description grammy 1.40.0 기반 Telegram Bot 연동
 */

import type { IncomingMessage, OutgoingMessage, ChannelCapabilities } from '../types.js';

/**
 * Telegram 설정
 */
export interface TelegramConfig {
  /** 봇 토큰 */
  botToken: string;
  /** 허용된 사용자 ID 목록 (화이트리스트) */
  allowedUsers?: string[];
  /** Webhook URL (선택사항) */
  webhookUrl?: string;
  /** 폧링 타임아웃 (초) */
  pollingTimeout?: number;
}

/**
 * Telegram 수신 메시지
 */
export interface TelegramIncomingMessage extends IncomingMessage {
  /** Telegram 메시지 ID */
  telegramMessageId: number;
  /** 채팅 ID */
  chatId: number;
  /** 사용자 정보 */
  from: {
    id: number;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
  /** 메시지 타입 */
  messageType: 'text' | 'photo' | 'audio' | 'document' | 'voice' | 'video';
  /** 파일 ID (미디어 메시지) */
  fileId?: string;
  /** 캡션 (미디어 메시지) */
  caption?: string;
}

/**
 * Telegram 발신 메시지
 */
export interface TelegramOutgoingMessage extends OutgoingMessage {
  /** 대상 채팅 ID */
  chatId: string;
  /** 메시지 텍스트 */
  text: string;
  /** Markdown 파싱 모드 */
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  /** 인라인 키보드 */
  replyMarkup?: TelegramInlineKeyboard;
  /** 답장할 메시지 ID */
  replyToMessageId?: number;
}

/**
 * 인라인 키보드
 */
export interface TelegramInlineKeyboard {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

/**
 * 인라인 키보드 버튼
 */
export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

/**
 * Telegram 채널 기능
 */
export const TELEGRAM_CAPABILITIES: ChannelCapabilities = {
  text: true,
  images: true,
  audio: true,
  video: true,
  documents: true,
  reactions: true,
  threads: true,
  typing: true,
  readReceipts: false,
};

/**
 * Telegram 어댑터 상태
 */
export interface TelegramAdapterState {
  connected: boolean;
  botInfo?: {
    id: number;
    username: string;
    firstName: string;
  };
  lastError?: string;
}
