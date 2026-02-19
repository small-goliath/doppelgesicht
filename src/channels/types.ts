/**
 * 채널 어댑터 공통 타입 정의
 * @description 모든 채널(Telegram, Slack 등)의 공통 인터페이스
 */

/**
 * 채널 기능
 */
export interface ChannelCapabilities {
  text: boolean;
  images: boolean;
  audio: boolean;
  video: boolean;
  documents: boolean;
  reactions: boolean;
  threads: boolean;
  typing: boolean;
  readReceipts: boolean;
}

/**
 * 수신 메시지
 */
export interface IncomingMessage {
  /** 메시지 ID */
  id: string;
  /** 채널 ID */
  channel: string;
  /** 메시지 텍스트 */
  text: string;
  /** 발신자 정보 */
  sender: {
    id: string;
    name: string;
    username?: string;
  };
  /** 수신 시간 */
  timestamp: Date;
  /** 첨부 파일 */
  attachments?: MessageAttachment[];
}

/**
 * 발신 메시지
 */
export interface OutgoingMessage {
  /** 메시지 텍스트 */
  text: string;
  /** 첨부 파일 */
  attachments?: MessageAttachment[];
  /** 답장할 메시지 ID */
  replyTo?: string;
}

/**
 * 메시지 첨부 파일
 */
export interface MessageAttachment {
  /** 파일 타입 */
  type: 'image' | 'audio' | 'video' | 'document';
  /** 파일 URL 또는 경로 */
  url: string;
  /** 파일명 */
  filename?: string;
  /** MIME 타입 */
  mimetype?: string;
  /** 파일 크기 */
  size?: number;
}

/**
 * 채널 설정
 */
export interface ChannelConfig {
  /** 채널 ID */
  id: string;
  /** 채널 이름 */
  name: string;
  /** 활성화 여부 */
  enabled: boolean;
  [key: string]: unknown;
}

/**
 * 채널 어댑터 인터페이스
 */
export interface IChannelAdapter {
  /** 어댑터 ID */
  readonly id: string;
  /** 채널 이름 */
  readonly name: string;
  /** 채널 기능 */
  readonly capabilities: ChannelCapabilities;

  /**
   * 어댑터 초기화
   */
  initialize(config: ChannelConfig): Promise<void>;

  /**
   * 채널 시작
   */
  start(): Promise<void>;

  /**
   * 채널 중지
   */
  stop(): Promise<void>;

  /**
   * 메시지 전송
   * @param to 대상 ID (채팅 ID, 채널 ID 등)
   * @param message 발신 메시지
   */
  send(to: string, message: OutgoingMessage): Promise<void>;

  /**
   * 메시지 수신 핸들러 등록
   */
  onMessage(handler: (message: IncomingMessage) => void | Promise<void>): void;

  /**
   * 타이핑 표시 (선택사항)
   */
  sendTypingIndicator?(to: string): Promise<void>;

  /**
   * 반응 추가 (선택사항)
   */
  react?(messageId: string, emoji: string): Promise<void>;
}

/**
 * 채널 레지스트리
 */
export interface ChannelRegistry {
  /**
   * 어댑터 등록
   */
  register(adapter: IChannelAdapter): void;

  /**
   * 어댑터 조회
   */
  get(id: string): IChannelAdapter | undefined;

  /**
   * 모든 어댑터 목록
   */
  getAll(): IChannelAdapter[];

  /**
   * 어댑터 제거
   */
  unregister(id: string): boolean;
}
