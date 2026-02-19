/**
 * Discord 채널 타입 정의
 * @description discord.js 14.x 기반 Discord Bot 연동
 */

import type { IncomingMessage, OutgoingMessage, ChannelCapabilities } from '../types.js';

/**
 * Discord 설정
 */
export interface DiscordConfig {
  /** 봇 토큰 */
  botToken: string;
  /** 허용된 사용자 ID 목록 (화이트리스트) */
  allowedUsers?: string[];
  /** 허용된 채널 ID 목록 (화이트리스트) */
  allowedChannels?: string[];
  /** 허용된 서버(길드) ID 목록 (화이트리스트) */
  allowedGuilds?: string[];
  /** DM 허용 여부 */
  allowDMs?: boolean;
  /** 명령어 접두사 (선택사항) */
  commandPrefix?: string;
  /** 활동 상태 메시지 */
  activityMessage?: string;
}

/**
 * Discord 수신 메시지
 */
export interface DiscordIncomingMessage extends IncomingMessage {
  /** Discord 메시지 ID */
  discordMessageId: string;
  /** 채널 ID */
  channelId: string;
  /** 서버(길드) ID (DM인 경우 null) */
  guildId?: string;
  /** 사용자 정보 */
  from: {
    id: string;
    username: string;
    discriminator?: string;
    displayName?: string;
    avatar?: string;
    bot: boolean;
  };
  /** 메시지 타입 */
  messageType: 'text' | 'dm' | 'mention' | 'reply' | 'file' | 'image';
  /** 첨부 파일 목록 */
  attachments?: DiscordAttachment[];
  /** 멘션된 사용자 ID 목록 */
  mentions?: string[];
  /** 답장 대상 메시지 ID */
  referenceMessageId?: string;
  /** 임베드 목록 */
  embeds?: unknown[];
}

/**
 * Discord 첨부 파일
 */
export interface DiscordAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  contentType?: string;
  description?: string;
  /** 파일 타입 */
  type: 'image' | 'audio' | 'video' | 'document';
}

/**
 * Discord 발신 메시지
 */
export interface DiscordOutgoingMessage extends OutgoingMessage {
  /** 대상 채널 ID */
  channelId: string;
  /** 메시지 텍스트 */
  text: string;
  /** 임베드 (Rich Embed) */
  embeds?: DiscordEmbed[];
  /** 컴포넌트 (버튼, 선택 메뉴 등) */
  components?: DiscordComponent[];
  /** 답장할 메시지 ID */
  replyToMessageId?: string;
  /** 멘션 허용 여부 */
  allowedMentions?: {
    parse?: ('roles' | 'users' | 'everyone')[];
    roles?: string[];
    users?: string[];
    repliedUser?: boolean;
  };
  /** TTS (Text-to-Speech) */
  tts?: boolean;
}

/**
 * Discord 임베드 (Rich Embed)
 */
export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: {
    text: string;
    icon_url?: string;
  };
  image?: {
    url: string;
  };
  thumbnail?: {
    url: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  fields?: {
    name: string;
    value: string;
    inline?: boolean;
  }[];
}

/**
 * Discord 컴포넌트 (버튼, 선택 메뉴 등)
 */
export interface DiscordComponent {
  type: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; // ComponentType
  components?: DiscordComponent[];
  style?: 1 | 2 | 3 | 4 | 5 | 6; // ButtonStyle
  label?: string;
  emoji?: {
    id?: string;
    name?: string;
    animated?: boolean;
  };
  custom_id?: string;
  url?: string;
  disabled?: boolean;
  options?: DiscordSelectOption[];
  placeholder?: string;
  min_values?: number;
  max_values?: number;
}

/**
 * Discord 선택 메뉴 옵션
 */
export interface DiscordSelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: {
    id?: string;
    name?: string;
    animated?: boolean;
  };
  default?: boolean;
}

/**
 * Discord 채널 기능
 */
export const DISCORD_CAPABILITIES: ChannelCapabilities = {
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
 * Discord 어댑터 상태
 */
export interface DiscordAdapterState {
  connected: boolean;
  botInfo?: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
  };
  guilds?: {
    id: string;
    name: string;
    memberCount: number;
  }[];
  lastError?: string;
  uptime?: number;
}

/**
 * Discord 명령어 인터랙션
 */
export interface DiscordCommandInteraction {
  id: string;
  name: string;
  userId: string;
  channelId: string;
  guildId?: string;
  options: Record<string, unknown>;
}

/**
 * Discord 버튼 인터랙션
 */
export interface DiscordButtonInteraction {
  id: string;
  customId: string;
  userId: string;
  channelId: string;
  guildId?: string;
  messageId: string;
}
