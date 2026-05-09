/**
 * 语音交互模块接口定义
 * Feature: 20260508-voice-interaction-feature
 *
 * 定义客户端-服务端 WebSocket 消息格式
 * 以及火山引擎 RealtimeAPI 相关类型
 */

// ==================== 客户端消息 ====================

/** 客户端发送的消息类型 */
export type ClientMessageType =
  | 'start_session'
  | 'end_session'
  | 'audio'
  | 'text';

/** 客户端消息基类 */
export interface BaseClientMessage {
  type: ClientMessageType;
}

/** 开始会话消息 */
export interface StartSessionMessage extends BaseClientMessage {
  type: 'start_session';
  /** 学习语言代码: cn, jp, us, es */
  language?: string;
}

/** 结束会话消息 */
export interface EndSessionMessage extends BaseClientMessage {
  type: 'end_session';
}

/** 音频数据消息 */
export interface AudioMessage extends BaseClientMessage {
  type: 'audio';
  /** Base64 编码的音频数据 (PCM 16kHz 16bit mono) */
  data: string;
}

/** 文本消息 (用于测试或绕过 ASR) */
export interface TextMessage extends BaseClientMessage {
  type: 'text';
  content: string;
}

/** 客户端消息联合类型 */
export type ClientMessage =
  | StartSessionMessage
  | EndSessionMessage
  | AudioMessage
  | TextMessage;

// ==================== 服务端事件 ====================

/** 服务端事件类型 */
export type ServerEventType =
  | 'connected'
  | 'asr'
  | 'chat'
  | 'tts'
  | 'tts_ended'
  | 'pronunciation'
  | 'error'
  | 'session_ended';

/** 服务端事件基类 */
export interface BaseServerEvent {
  type: ServerEventType;
}

/** 连接成功事件 */
export interface ConnectedEvent extends BaseServerEvent {
  type: 'connected';
  sessionId: string;
}

/** ASR 识别结果事件 */
export interface AsrEvent extends BaseServerEvent {
  type: 'asr';
  /** 是否为最终结果 */
  isFinal: boolean;
  /** 识别文本 */
  text: string;
}

/** AI 文本回复事件 */
export interface ChatEvent extends BaseServerEvent {
  type: 'chat';
  /** 是否为最终结果 */
  isFinal: boolean;
  /** 回复文本 */
  text: string;
}

/** TTS 音频数据事件 */
export interface TtsEvent extends BaseServerEvent {
  type: 'tts';
  /** Base64 编码的音频数据 */
  audio: string;
}

/** TTS 播放结束事件 */
export interface TtsEndedEvent extends BaseServerEvent {
  type: 'tts_ended';
}

/** 发音问题 */
export interface PronunciationProblem {
  /** 期望的音素/发音 */
  expected: string;
  /** 实际发音 (仅 wrong 类型有) */
  actual?: string;
  /** 问题类型 */
  type: 'missing' | 'wrong' | 'extra';
}

/** 发音分析结果 */
export interface PronunciationResult {
  /** 总体评分 (0-100) */
  score: number;
  /** 问题音素列表 */
  problems: PronunciationProblem[];
  /** 改进建议 */
  suggestion: string;
}

/** 发音分析事件 */
export interface PronunciationEvent extends BaseServerEvent {
  type: 'pronunciation';
  result: PronunciationResult;
}

/** 错误事件 */
export interface ErrorEvent extends BaseServerEvent {
  type: 'error';
  code: string;
  message: string;
  /** 是否可重试 */
  retryable?: boolean;
}

/** 会话结束事件 */
export interface SessionEndedEvent extends BaseServerEvent {
  type: 'session_ended';
}

/** 服务端事件联合类型 */
export type ServerEvent =
  | ConnectedEvent
  | AsrEvent
  | ChatEvent
  | TtsEvent
  | TtsEndedEvent
  | PronunciationEvent
  | ErrorEvent
  | SessionEndedEvent;

// ==================== 火山引擎 RealtimeAPI ====================

/** RealtimeAPI 配置 */
export interface RealtimeApiConfig {
  appId: string;
  accessKey: string;
  resourceId: string;
  appKey: string;
}

/** RealtimeAPI 请求头 */
export interface RealtimeApiHeaders {
  'X-Api-App-ID': string;
  'X-Api-Access-Key': string;
  'X-Api-Resource-Id': string;
  'X-Api-App-Key': string;
  [key: string]: string; // 允许索引签名
}

/** RealtimeAPI WebSocket URL */
export const REALTIME_API_URL =
  'wss://openspeech.bytedance.com/api/v3/realtime/dialogue';

// ==================== 会话状态 ====================

/** 会话状态 */
export interface VoiceSessionState {
  /** 会话 ID */
  sessionId: string;
  /** 学习语言 */
  language: string;
  /** 是否已连接到 RealtimeAPI */
  isConnected: boolean;
  /** 创建时间 */
  createdAt: Date;
}
