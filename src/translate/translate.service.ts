import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranslateRequestDto, TranslateResponseDto } from './dto';

const ARK_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const ARK_MODEL = 'doubao-1-5-lite-32k-250115';
const ARK_REQUEST_TIMEOUT_MS = 30_000;

interface ArkChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

@Injectable()
export class TranslateService {
  constructor(private readonly configService: ConfigService) {}

  async translate(dto: TranslateRequestDto): Promise<TranslateResponseDto> {
    const apiKey = this.configService.get<string>('ARK_API_KEY');

    if (!apiKey) {
      throw new InternalServerErrorException('请先配置 ARK_API_KEY');
    }

    const sourceLang = dto.sourceLanguage || 'auto';
    const targetLang = dto.targetLanguage || '中文';

    const systemPrompt = this.buildSystemPrompt(sourceLang, targetLang);
    const userPrompt = dto.text;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort('timeout');
    }, ARK_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(ARK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: ARK_MODEL,
          stream: false,
          temperature: 0.3,
          max_tokens: 500,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new BadGatewayException(errorText || 'Ark 请求失败');
      }

      const data = (await response.json()) as ArkChatResponse;

      if (data.error?.message) {
        throw new BadGatewayException(data.error.message);
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new BadGatewayException('Ark 返回空响应');
      }

      return this.parseTranslateResponse(content);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new BadGatewayException('翻译请求超时');
      }
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException(
        error instanceof Error ? error.message : '翻译请求失败',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildSystemPrompt(sourceLang: string, targetLang: string): string {
    const sourceLangDesc = sourceLang === 'auto' ? '自动检测' : sourceLang;

    return `你是一个专业的语言翻译助手。请将用户提供的文本从${sourceLangDesc}翻译成${targetLang}。

请按以下JSON格式返回结果（不要包含任何其他文字或markdown格式）：
{
  "translation": "翻译结果",
  "pronunciation": "拼音或音标（如果是从其他语言翻译成中文，提供中文拼音；如果是中文翻译成其他语言，提供该语言的音标或发音指南）",
  "example": {
    "sentence": "使用该词/短语的一个例句",
    "translation": "例句的翻译"
  }
}

注意事项：
1. 翻译要准确、自然、地道
2. 拼音/音标要准确
3. 例句要实用且符合日常使用场景
4. 如果输入是一个单词或短语，例句应该展示其用法
5. 如果输入是一个句子，例句可以是相似场景的另一个例句
6. 只返回JSON，不要包含任何其他内容`;
  }

  private parseTranslateResponse(content: string): TranslateResponseDto {
    try {
      // 尝试提取JSON部分（处理可能的markdown代码块）
      let jsonContent = content.trim();

      // 如果包含markdown代码块，提取其中的内容
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonContent);

      // 验证必要字段
      if (!parsed.translation) {
        throw new Error('缺少翻译结果');
      }

      return {
        translation: parsed.translation,
        pronunciation: parsed.pronunciation || '',
        example: {
          sentence: parsed.example?.sentence || '',
          translation: parsed.example?.translation || '',
        },
      };
    } catch {
      // 如果解析失败，返回原始内容作为翻译结果
      return {
        translation: content,
        pronunciation: '',
        example: {
          sentence: '',
          translation: '',
        },
      };
    }
  }
}
