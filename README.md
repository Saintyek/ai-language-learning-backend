# AI Language Learning Backend

运行： `npm run start`

## 环境变量配置

创建 `.env` 文件并配置以下环境变量：

### 必需配置

```env
ARK_API_KEY=your_ark_api_key
```

### TTS 语音合成配置（可选）

```env
VOLCENGINE_TTS_API_KEY=your_tts_api_key
VOLCENGINE_TTS_RESOURCE_ID=seed-tts-2.0
VOLCENGINE_TTS_DEFAULT_SPEAKER=zh_female_vv_uranus_bigtts
```

## TTS 功能

后端集成了火山引擎 TTS 双向流式语音合成功能：

- **API 端点**: `POST /api/chat/messages/stream`
- **参数**: `enableTTS: boolean` - 启用/禁用语音合成
- **音频格式**: MP3, 24000Hz
- **默认音色**: zh_female_vv_uranus_bigtts (豆包语音合成模型 2.0)

### SSE 事件类型

当 `enableTTS: true` 时，响应会包含额外的 `audio` 事件：

```
event: start
data: {"model":"doubao-1-5-lite-32k-250115","ttsEnabled":true}

event: delta
data: {"content":"你好"}

event: audio
data: {"audio":"base64_encoded_audio_data"}

event: done
data: {"model":"doubao-1-5-lite-32k-250115"}
```
