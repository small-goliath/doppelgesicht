import { describe, it, expect } from 'vitest';
import type {
  ChannelCapabilities,
  IncomingMessage,
  OutgoingMessage,
  MessageAttachment,
  ChannelConfig,
} from '../../../src/channels/types.js';

describe('Channel Types', () => {
  describe('ChannelCapabilities', () => {
    it('전체 기능을 가진 채널을 생성해야 함', () => {
      const capabilities: ChannelCapabilities = {
        text: true,
        images: true,
        audio: true,
        video: true,
        documents: true,
        reactions: true,
        threads: true,
        typing: true,
        readReceipts: true,
      };

      expect(capabilities.text).toBe(true);
      expect(capabilities.images).toBe(true);
      expect(capabilities.reactions).toBe(true);
    });

    it('제한된 기능을 가진 채널을 생성해야 함', () => {
      const capabilities: ChannelCapabilities = {
        text: true,
        images: false,
        audio: false,
        video: false,
        documents: false,
        reactions: false,
        threads: false,
        typing: false,
        readReceipts: false,
      };

      expect(capabilities.text).toBe(true);
      expect(capabilities.images).toBe(false);
    });
  });

  describe('IncomingMessage', () => {
    it('텍스트 메시지를 생성해야 함', () => {
      const message: IncomingMessage = {
        id: 'msg-1',
        channel: 'telegram',
        text: 'Hello!',
        sender: {
          id: 'user-1',
          name: 'John Doe',
          username: 'johndoe',
        },
        timestamp: new Date(),
      };

      expect(message.id).toBe('msg-1');
      expect(message.channel).toBe('telegram');
      expect(message.text).toBe('Hello!');
      expect(message.sender.name).toBe('John Doe');
    });

    it('첨부 파일이 있는 메시지를 생성해야 함', () => {
      const attachment: MessageAttachment = {
        type: 'image',
        url: 'https://example.com/image.jpg',
        filename: 'image.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
      };

      const message: IncomingMessage = {
        id: 'msg-2',
        channel: 'slack',
        text: 'Check this image',
        sender: {
          id: 'user-2',
          name: 'Jane Doe',
        },
        timestamp: new Date(),
        attachments: [attachment],
      };

      expect(message.attachments).toHaveLength(1);
      expect(message.attachments?.[0].type).toBe('image');
    });
  });

  describe('OutgoingMessage', () => {
    it('발신 메시지를 생성해야 함', () => {
      const message: OutgoingMessage = {
        text: 'Hello from bot!',
      };

      expect(message.text).toBe('Hello from bot!');
    });

    it('답장 메시지를 생성해야 함', () => {
      const message: OutgoingMessage = {
        text: 'This is a reply',
        replyTo: 'msg-1',
      };

      expect(message.replyTo).toBe('msg-1');
    });
  });

  describe('MessageAttachment', () => {
    it('이미지 첨부를 생성해야 함', () => {
      const attachment: MessageAttachment = {
        type: 'image',
        url: 'https://example.com/photo.png',
        filename: 'photo.png',
        mimetype: 'image/png',
        size: 2048,
      };

      expect(attachment.type).toBe('image');
      expect(attachment.mimetype).toBe('image/png');
    });

    it('문서 첨부를 생성해야 함', () => {
      const attachment: MessageAttachment = {
        type: 'document',
        url: 'https://example.com/doc.pdf',
        filename: 'document.pdf',
        mimetype: 'application/pdf',
        size: 102400,
      };

      expect(attachment.type).toBe('document');
      expect(attachment.size).toBe(102400);
    });
  });

  describe('ChannelConfig', () => {
    it('채널 설정을 생성해야 함', () => {
      const config: ChannelConfig = {
        id: 'telegram-1',
        name: 'Telegram Bot',
        enabled: true,
        botToken: 'secret-token',
      };

      expect(config.id).toBe('telegram-1');
      expect(config.enabled).toBe(true);
      expect(config.botToken).toBe('secret-token');
    });
  });
});
