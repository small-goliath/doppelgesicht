import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command } from 'commander';
import { registerAuthCommand } from '../../../src/cli/commands/auth.js';

// 의존성 모킹
vi.mock('@clack/prompts', () => ({
  spinner: vi.fn().mockReturnValue({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  }),
  log: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn().mockResolvedValue('test-value'),
  password: vi.fn().mockResolvedValue('test-api-key'),
  select: vi.fn().mockResolvedValue('anthropic'),
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
}));

vi.mock('../../../src/security/master-key.js', () => ({
  getMasterKey: vi.fn().mockResolvedValue(Buffer.from('test-master-key-32-bytes-long!!')),
}));

vi.mock('../../../src/core/auth-profile.js', () => ({
  AuthProfileManager: vi.fn().mockImplementation(() => ({
    setMasterKey: vi.fn(),
    getAllProfiles: vi.fn().mockReturnValue([]),
    getProfile: vi.fn().mockReturnValue(null),
    createProfile: vi.fn().mockReturnValue({
      id: 'profile-1',
      name: 'Test Profile',
      provider: 'anthropic',
    }),
    deleteProfile: vi.fn().mockReturnValue(true),
  })),
}));

describe('Auth Command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerAuthCommand(program);
    vi.clearAllMocks();
  });

  describe('명령어 등록', () => {
    it('auth 명령어를 등록해야 함', () => {
      const commands = program.commands.map(cmd => cmd.name());
      expect(commands).toContain('auth');
    });

    it('list 서브커맨드를 등록해야 함', () => {
      const authCmd = program.commands.find(cmd => cmd.name() === 'auth');
      const subcommands = authCmd?.commands.map(cmd => cmd.name()) || [];
      expect(subcommands).toContain('list');
    });

    it('add 서브커맨드를 등록해야 함', () => {
      const authCmd = program.commands.find(cmd => cmd.name() === 'auth');
      const subcommands = authCmd?.commands.map(cmd => cmd.name()) || [];
      expect(subcommands).toContain('add');
    });

    it('remove 서브커맨드를 등록해야 함', () => {
      const authCmd = program.commands.find(cmd => cmd.name() === 'auth');
      const subcommands = authCmd?.commands.map(cmd => cmd.name()) || [];
      expect(subcommands).toContain('remove');
    });

    it('test 서브커맨드를 등록해야 함', () => {
      const authCmd = program.commands.find(cmd => cmd.name() === 'auth');
      const subcommands = authCmd?.commands.map(cmd => cmd.name()) || [];
      expect(subcommands).toContain('test');
    });
  });

  describe('명령어 설명', () => {
    it('auth 명령어에 설명이 있어야 함', () => {
      const authCmd = program.commands.find(cmd => cmd.name() === 'auth');
      expect(authCmd?.description()).toBe('Manage authentication profiles');
    });
  });
});
