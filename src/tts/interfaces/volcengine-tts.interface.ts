/**
 * 火山引擎 TTS HTTP Chunked 单向流式-V3 API 协议定义
 * 文档: https://www.volcengine.com/docs/6561/1598757
 */

/** HTTP API 请求体 */
export interface TTSHttpRequest {
  user?: {
    uid?: string;
  };
  req_params: {
    text: string;
    speaker: string;
    audio_params: TTSAudioParams;
    ssml?: string;
    model?: string;
  };
}

/** 音频参数 */
export interface TTSAudioParams {
  format: 'mp3' | 'ogg_opus' | 'pcm' | 'wav';
  sample_rate: number;
  bit_rate?: number;
  emotion?: string;
  emotion_scale?: number;
  speech_rate?: number;
  loudness_rate?: number;
}

/** HTTP API 音频数据响应 */
export interface TTSHttpResponse {
  code: number;
  message: string;
  data: string | null; // base64 编码的音频数据
}

/** HTTP API 合成结束响应 */
export interface TTSHttpFinishResponse {
  code: number;
  message: string;
  data: null;
  usage?: {
    text_words: number;
  };
}

/** 连接配置 */
export interface TTSConnectionConfig {
  apiKey: string;
  resourceId: string;
  speaker?: string;
  format?: 'mp3' | 'ogg_opus' | 'pcm' | 'wav';
  sampleRate?: number;
  bitRate?: number;
}

/** 默认配置 */
export const DEFAULT_TTS_CONFIG: Required<
  Omit<TTSConnectionConfig, 'apiKey' | 'resourceId'>
> = {
  speaker: 'zh_female_vv_uranus_bigtts',
  format: 'mp3',
  sampleRate: 24000,
  bitRate: 128000,
};

/** TTS 服务选项 */
export interface TTSServiceOptions {
  /** 请求超时时间 (毫秒) */
  timeout?: number;
  /** 是否启用连接复用 */
  keepAlive?: boolean;
}

/** 错误响应 */
export interface TTSErrorResponse {
  code: number;
  message: string;
}

/** 错误码常量 */
export const TTS_ERROR_CODES = {
  SUCCESS: 20000000,
  TEXT_LIMIT_EXCEEDED: 40402003,
  SPEAKER_PERMISSION_DENIED: 45000000,
  QUOTA_EXCEEDED: 45000000,
  SERVER_ERROR: 55000000,
} as const;
