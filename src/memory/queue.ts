/**
 * 동시성 제어 - 접근 큐 구현
 * @description SQLite 데이터베이스 동시 접근 관리
 */

import { randomUUID } from 'crypto';
import type { QueueTask } from './types.js';

/**
 * 접근 큐 관리자
 */
export class AccessQueue {
  private queue: QueueTask<unknown>[] = [];
  private isProcessing = false;
  private maxQueueSize: number;
  private defaultTimeout: number;

  constructor(maxQueueSize: number = 100, defaultTimeout: number = 5000) {
    this.maxQueueSize = maxQueueSize;
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * 작업 큐에 추가
   */
  async enqueue<T>(
    execute: () => Promise<T>,
    timeout: number = this.defaultTimeout
  ): Promise<T> {
    // 큐 크기 확인
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(`Queue is full (max size: ${this.maxQueueSize})`);
    }

    return new Promise((resolve, reject) => {
      const task: QueueTask<T> = {
        id: randomUUID(),
        execute,
        timeout,
        createdAt: new Date(),
        resolve: resolve as (value: unknown) => void,
        reject: reject as (error: Error) => void,
      };

      this.queue.push(task as QueueTask<unknown>);
      this.processQueue();
    });
  }

  /**
   * 큐 처리
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) continue;

      try {
        // 타임아웃 설정
        const result = await this.executeWithTimeout(task.execute, task.timeout);
        task.resolve(result);
      } catch (error) {
        task.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.isProcessing = false;
  }

  /**
   * 타임아웃과 함께 실행
   */
  private executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 큐 크기 조회
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * 처리 중 여부 조회
   */
  isProcessingQueue(): boolean {
    return this.isProcessing;
  }

  /**
   * 큐 초기화
   */
  clear(): void {
    // 대기 중인 작업들 모두 에러 처리
    for (const task of this.queue) {
      task.reject(new Error('Queue was cleared'));
    }
    this.queue = [];
    this.isProcessing = false;
  }
}

/**
 * 읽기/쓰기 락 관리자
 */
export class ReadWriteLock {
  private readers = 0;
  private writers = 0;
  private writeQueue: (() => void)[] = [];
  private readQueue: (() => void)[] = [];

  /**
   * 읽기 락 획득
   */
  async acquireRead(): Promise<void> {
    if (this.writers > 0 || this.writeQueue.length > 0) {
      await new Promise<void>((resolve) => {
        this.readQueue.push(resolve);
      });
    }
    this.readers++;
  }

  /**
   * 읽기 락 해제
   */
  releaseRead(): void {
    this.readers--;
    if (this.readers === 0 && this.writeQueue.length > 0) {
      const next = this.writeQueue.shift();
      next?.();
    }
  }

  /**
   * 쓰기 락 획득
   */
  async acquireWrite(): Promise<void> {
    if (this.readers > 0 || this.writers > 0) {
      await new Promise<void>((resolve) => {
        this.writeQueue.push(resolve);
      });
    }
    this.writers++;
  }

  /**
   * 쓰기 락 해제
   */
  releaseWrite(): void {
    this.writers--;
    if (this.writers === 0) {
      // 대기 중인 쓰기 작업 먼저 처리
      if (this.writeQueue.length > 0) {
        const next = this.writeQueue.shift();
        next?.();
      } else {
        // 읽기 작업 모두 처리
        while (this.readQueue.length > 0) {
          const next = this.readQueue.shift();
          next?.();
        }
      }
    }
  }
}
