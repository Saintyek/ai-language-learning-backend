/**
 * 火山引擎 RealtimeAPI 二进制协议工具
 * Feature: 20260508-voice-interaction-feature
 *
 * 实现二进制帧的编码和解码
 */

/** 协议版本 */
const PROTOCOL_VERSION = 0x01;

/** 头部大小 */
const HEADER_SIZE = 0x01;

/** 消息类型 */
export enum MessageType {
  FULL_CLIENT_REQUEST = 0b0001, // 客户端文本事件
  AUDIO_ONLY_REQUEST = 0b0010, // 客户端音频数据
  FULL_SERVER_RESPONSE = 0b1001, // 服务端文本事件
  AUDIO_ONLY_RESPONSE = 0b1011, // 服务端音频数据
  ERROR = 0b1111, // 错误信息
}

/** 序列化方法 */
export enum SerializationMethod {
  RAW = 0b0000, // 二进制音频
  JSON = 0b0001, // JSON
}

/** 压缩方法 */
export enum CompressionMethod {
  NONE = 0b0000,
  GZIP = 0b0001,
}

/** 客户端事件ID */
export enum ClientEventId {
  StartConnection = 1,
  FinishConnection = 2,
  StartSession = 100,
  FinishSession = 102,
  TaskRequest = 200, // 音频数据
  UpdateConfig = 201,
  SayHello = 300,
  EndASR = 400,
  ChatTTSText = 500,
  ChatTextQuery = 501,
  ChatRAGText = 502,
  ConversationCreate = 510,
  ConversationUpdate = 511,
  ConversationRetrieve = 512,
  ConversationTruncate = 513,
  ConversationDelete = 514,
  ClientInterrupt = 515,
}

/** 服务端事件ID */
export enum ServerEventId {
  ConnectionStarted = 50,
  ConnectionFailed = 51,
  ConnectionFinished = 52,
  SessionStarted = 150,
  SessionFinished = 152,
  SessionFailed = 153,
  UsageResponse = 154,
  ConfigUpdated = 251,
  TTSSentenceStart = 350,
  TTSSentenceEnd = 351,
  TTSResponse = 352, // 音频数据
  TTSEnded = 359,
  ASRInfo = 450,
  ASRResponse = 451, // ASR 识别结果
  ASREnded = 459,
  ChatResponse = 550, // AI 回复
  ChatTextQueryConfirmed = 553,
  ChatEnded = 559,
  DialogCommonError = 599,
}

/** 二进制帧接口 */
export interface BinaryFrame {
  messageType: MessageType;
  serializationMethod: SerializationMethod;
  compressionMethod: CompressionMethod;
  eventId?: number;
  sessionId?: string;
  payload: Buffer;
}

/**
 * 编码客户端事件为二进制帧
 */
export function encodeClientEvent(
  eventId: ClientEventId,
  payload: object | Buffer,
  sessionId?: string,
): Buffer {
  const isBinary = Buffer.isBuffer(payload);
  const serialization = isBinary
    ? SerializationMethod.RAW
    : SerializationMethod.JSON;
  const payloadBuffer = isBinary
    ? (payload as Buffer)
    : Buffer.from(JSON.stringify(payload));

  // 构建可选字段
  const optionalFields: Buffer[] = [];

  // 事件ID (必须)
  const eventIdBuffer = Buffer.alloc(4);
  eventIdBuffer.writeUInt32BE(eventId, 0);
  optionalFields.push(eventIdBuffer);

  // Session ID (如果提供)
  if (sessionId) {
    const sessionIdBuffer = Buffer.from(sessionId, 'utf-8');
    const sessionIdSizeBuffer = Buffer.alloc(4);
    sessionIdSizeBuffer.writeUInt32BE(sessionIdBuffer.length, 0);
    optionalFields.push(sessionIdSizeBuffer, sessionIdBuffer);
  }

  const optionalBuffer = Buffer.concat(optionalFields);

  // 构建头部 (4字节)
  const header = Buffer.alloc(4);
  // 字节0: 协议版本 (高4位) + 头部大小 (低4位)
  header[0] = (PROTOCOL_VERSION << 4) | HEADER_SIZE;
  // 字节1: 消息类型 (高4位) + 消息类型特定标志 (低4位)
  // 标志位: 0b0100 表示携带事件ID
  const messageType = isBinary
    ? MessageType.AUDIO_ONLY_REQUEST
    : MessageType.FULL_CLIENT_REQUEST;
  header[1] = (messageType << 4) | 0b0100;
  // 字节2: 序列化方法 (高4位) + 压缩方法 (低4位)
  header[2] = (serialization << 4) | CompressionMethod.NONE;
  // 字节3: 保留
  header[3] = 0x00;

  // 构建负载大小和负载
  const payloadSizeBuffer = Buffer.alloc(4);
  payloadSizeBuffer.writeUInt32BE(payloadBuffer.length, 0);

  return Buffer.concat([
    header,
    optionalBuffer,
    payloadSizeBuffer,
    payloadBuffer,
  ]);
}

/**
 * 解码服务端二进制帧
 */
export function decodeServerFrame(data: Buffer): BinaryFrame | null {
  if (data.length < 4) {
    return null;
  }

  // 解析头部
  const headerByte1 = data[0];
  const headerByte2 = data[1];
  const headerByte3 = data[2];

  const messageType = (headerByte2 >> 4) & 0x0f;
  const messageFlags = headerByte2 & 0x0f;
  const serializationMethod = (headerByte3 >> 4) & 0x0f;
  const compressionMethod = headerByte3 & 0x0f;

  // 跳过头部，解析可选字段
  let offset = 4;

  // 解析事件ID (如果标志位包含 0b0100)
  let eventId: number | undefined;
  if (messageFlags & 0b0100 && offset + 4 <= data.length) {
    eventId = data.readUInt32BE(offset);
    offset += 4;
  }

  // 解析 session ID (对于会话级事件)
  let sessionId: string | undefined;
  if (eventId && offset + 4 <= data.length) {
    const sessionIdSize = data.readUInt32BE(offset);
    offset += 4;
    if (offset + sessionIdSize <= data.length) {
      sessionId = data.toString('utf-8', offset, offset + sessionIdSize);
      offset += sessionIdSize;
    }
  }

  // 解析负载大小和负载
  if (offset + 4 > data.length) {
    return null;
  }
  const payloadSize = data.readUInt32BE(offset);
  offset += 4;

  if (offset + payloadSize > data.length) {
    return null;
  }
  const payload = data.subarray(offset, offset + payloadSize);

  return {
    messageType: messageType as MessageType,
    serializationMethod: serializationMethod as SerializationMethod,
    compressionMethod: compressionMethod as CompressionMethod,
    eventId,
    sessionId,
    payload,
  };
}

/**
 * 解析服务端事件
 */
export function parseServerEvent(frame: BinaryFrame): {
  eventId: number;
  data: unknown;
} | null {
  if (!frame.eventId) {
    return null;
  }

  let data: unknown;
  if (frame.serializationMethod === SerializationMethod.JSON) {
    try {
      data = JSON.parse(frame.payload.toString('utf-8'));
    } catch {
      data = frame.payload.toString('utf-8');
    }
  } else {
    data = frame.payload;
  }

  return {
    eventId: frame.eventId,
    data,
  };
}
