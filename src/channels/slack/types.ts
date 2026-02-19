/**
 * Slack 채널 타입 정의
 * @description @slack/bolt 4.6.0, @slack/web-api 7.14.0 기반
 */

import type { IncomingMessage, OutgoingMessage, ChannelCapabilities } from '../types.js';

/**
 * Slack 설정
 */
export interface SlackConfig {
  /** App 토큰 (Socket Mode) */
  appToken?: string;
  /** Bot 토큰 */
  botToken: string;
  /** Signing Secret (HTTP 모드) */
  signingSecret?: string;
  /** 허용된 사용자 ID 목록 (화이트리스트) */
  allowedUsers?: string[];
  /** Socket Mode 사용 여부 */
  socketMode?: boolean;
  /** HTTP 포트 (HTTP 모드) */
  port?: number;
}

/**
 * Slack 수신 메시지
 */
export interface SlackIncomingMessage extends IncomingMessage {
  /** Slack 메시지 TS */
  slackTs: string;
  /** 채널 ID */
  channelId: string;
  /** 팀 ID */
  teamId?: string;
  /** 스레드 TS (스레드 메시지인 경우) */
  threadTs?: string;
  /** 메시지 타입 */
  messageType: 'text' | 'file' | 'image' | 'code';
  /** 파일 목록 */
  files?: SlackFile[];
  /** 블록킷 블록 */
  blocks?: unknown[];
}

/**
 * Slack 파일
 */
export interface SlackFile {
  id: string;
  name: string;
  url: string;
  mimetype: string;
  size: number;
}

/**
 * Slack 발신 메시지
 */
export interface SlackOutgoingMessage extends OutgoingMessage {
  /** 대상 채널 ID */
  channelId: string;
  /** 메시지 텍스트 */
  text: string;
  /** 스레드 TS (답장) */
  threadTs?: string;
  /** 블록킷 블록 */
  blocks?: unknown[];
  /** 첨부 파일 */
  attachments?: SlackAttachment[];
  /** Markdown 사용 */
  mrkdwn?: boolean;
}

/**
 * Slack 첨부 파일
 */
export interface SlackAttachment {
  color?: string;
  title?: string;
  text?: string;
  fields?: {
    title: string;
    value: string;
    short?: boolean;
  }[];
}

/**
 * Slack 채널 기능
 */
export const SLACK_CAPABILITIES: ChannelCapabilities = {
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
 * Slack 어댑터 상태
 */
export interface SlackAdapterState {
  connected: boolean;
  authInfo?: {
    userId: string;
    user: string;
    teamId: string;
    team: string;
  };
  lastError?: string;
  socketMode: boolean;
}
