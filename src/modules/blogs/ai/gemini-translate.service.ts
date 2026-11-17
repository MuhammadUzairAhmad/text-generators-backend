import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { transliterateToSlug } from '../../../common/utils/slug.util';

export const SUPPORTED_LOCALES = [
  'en',
  'nl',
  'es',
  'zh',
  'fr',
  'ru',
  'ar',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type TranslationScope = 'title' | 'content' | 'faqs' | 'seo';

export interface BlogFAQ {
  question: string;
  answer: string;
}

export interface BlogTranslation {
  title: string;
  slug: string;
  excerpt: string;
  content: Record<string, unknown>;
  metaTitle: string;
  metaDescription: string;
  coverImageAlt: string;
  faqs: BlogFAQ[];
}

export interface TranslateArticleInput {
  title: string;
  slug?: string;
  excerpt?: string;
  content?: Record<string, unknown>;
  metaTitle?: string;
  metaDescription?: string;
  coverImageAlt?: string;
  faqs?: BlogFAQ[];
  fromLang?: string;
  toLang: SupportedLocale;
  scopes?: TranslationScope[];
}

export interface TranslationResult {
  success: boolean;
  translation?: BlogTranslation;
  error?: string;
  isMock?: boolean;
}

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
];

const LANGUAGE_PROMPTS: Record<SupportedLocale, string> = {
  en: 'English (standard UK/US web copywriting)',
  nl: 'Dutch (Nederlands - natural, idiomatic web phrasing)',
  es: 'Spanish (Español neutro - authentic grammar, accents like á/é/í/ó/ú/ñ, inverted punctuation ¿?, ¡!)',
  fr: 'French (Français - elegant grammar, correct accents é/è/ê/à/ç, appropriate web terminology)',
  ru: 'Russian (Русский - natural modern Russian copywriting, Cyrillic script)',
  zh: 'Simplified Chinese (简体中文 - natural fluency, standard web typography and vocabulary)',
  ar: 'Modern Standard Arabic (العربية الفصحى - authentic Arabic phrasing, natural right-to-left syntactic flow)',
};

@Injectable()
export class GeminiTranslateService {
  private readonly logger = new Logger(GeminiTranslateService.name);

  constructor(private readonly configService: ConfigService) {}

  private getGeminiApiKey(): string | undefined {
    return this.configService.get<string>('GEMINI_API_KEY')?.trim();
  }

  generateCleanSlug(title: string, baseSlug: string, targetLang: SupportedLocale): string {
    const transliterated = transliterateToSlug(title);
    if (transliterated && transliterated.length >= 3) {
      return transliterated;
    }
    const cleanBase = transliterateToSlug(baseSlug);
    return cleanBase
      ? `${cleanBase}-${targetLang}`
      : `article-${targetLang}-${Date.now().toString(36)}`;
  }

  estimateNodeWords(node: unknown): number {
    if (!node || typeof node !== 'object') return 0;
    if (Array.isArray(node)) {
      return node.reduce((acc, child) => acc + this.estimateNodeWords(child), 0);
    }
    const record = node as Record<string, unknown>;
    let words = 0;
    if (typeof record.text === 'string') {
      words += record.text.trim().split(/\s+/).filter(Boolean).length;
    }
    if (Array.isArray(record.content)) {
      words += this.estimateNodeWords(record.content);
    }
    return words;
  }

  splitTiptapNodesIntoChunks(
    nodes: Record<string, unknown>[],
    maxWordsPerChunk = 1500,
  ): Record<string, unknown>[][] {
    if (!nodes || nodes.length === 0) return [];
    if (nodes.length <= 12) return [nodes];

    const chunks: Record<string, unknown>[][] = [];
    let currentChunk: Record<string, unknown>[] = [];
    let currentWordCount = 0;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const nodeWords = this.estimateNodeWords(node);
      const isHeading = node.type === 'heading';

      const shouldSplitAtHeading = isHeading && currentWordCount >= 900;
      const shouldSplitAtBudget =
        currentWordCount + nodeWords > maxWordsPerChunk && currentChunk.length > 0;

      if (shouldSplitAtHeading || shouldSplitAtBudget) {
        chunks.push(currentChunk);
        currentChunk = [node];
        currentWordCount = nodeWords;
      } else {
        currentChunk.push(node);
        currentWordCount += nodeWords;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private async asyncMapPool<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = Array.from({ length: items.length });
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex++;
        results[currentIndex] = await fn(items[currentIndex], currentIndex);
      }
    };

    const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
  }

  private cloneTiptapWithTranslatedText(
    node: unknown,
    textReplacer: (original: string) => string,
  ): unknown {
    if (!node || typeof node !== 'object') return node;

    if (Array.isArray(node)) {
      return node.map((item) => this.cloneTiptapWithTranslatedText(item, textReplacer));
    }

    const record = node as Record<string, unknown>;

    if (record.type === 'codeBlock') {
      return record;
    }

    const cloned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(record)) {
      if (key === 'text' && typeof val === 'string') {
        cloned.text = textReplacer(val);
      } else if (key === 'attrs' && typeof val === 'object' && val !== null) {
        const clonedAttrs = { ...(val as Record<string, unknown>) };
        if (
          record.type === 'image' &&
          typeof clonedAttrs.alt === 'string' &&
          clonedAttrs.alt.trim()
        ) {
          clonedAttrs.alt = textReplacer(clonedAttrs.alt);
        }
        cloned.attrs = clonedAttrs;
      } else if (key === 'content' && Array.isArray(val)) {
        cloned.content = val.map((child) =>
          this.cloneTiptapWithTranslatedText(child, textReplacer),
        );
      } else if (typeof val === 'object' && val !== null) {
        cloned[key] = this.cloneTiptapWithTranslatedText(val, textReplacer);
      } else {
        cloned[key] = val;
      }
    }

    return cloned;
  }

  private generateMockTranslation(input: TranslateArticleInput): TranslationResult {
    const {
      title,
      slug,
      excerpt,
      content,
      metaTitle,
      metaDescription,
      coverImageAlt,
      faqs,
      toLang,
      scopes,
    } = input;
    const langUpper = toLang.toUpperCase();

    const includeTitle = !scopes || scopes.includes('title');
    const includeContent = !scopes || scopes.includes('content');
    const includeFaqs = !scopes || scopes.includes('faqs');
    const includeSeo = !scopes || scopes.includes('seo');

    const mockTitle = includeTitle ? `[${langUpper}] ${title}` : title;
    const mockSlug = includeTitle
      ? this.generateCleanSlug(title, slug || 'article', toLang)
      : slug || 'article';
    const mockExcerpt = includeTitle
      ? excerpt
        ? `[${langUpper}] ${excerpt}`
        : ''
      : excerpt || '';
    const mockMetaTitle = includeSeo
      ? metaTitle
        ? `[${langUpper}] ${metaTitle}`
        : `[${langUpper}] ${title}`
      : metaTitle || title;
    const mockMetaDesc = includeSeo
      ? metaDescription
        ? `[${langUpper}] ${metaDescription}`
        : excerpt
          ? `[${langUpper}] ${excerpt}`
          : ''
      : metaDescription || excerpt || '';
    const mockCoverAlt = includeSeo
      ? coverImageAlt
        ? `[${langUpper}] ${coverImageAlt}`
        : ''
      : coverImageAlt || '';

    const mockFaqs = includeFaqs
      ? Array.isArray(faqs)
        ? faqs.map((f) => ({
            question: f.question ? `[${langUpper}] ${f.question}` : '',
            answer: f.answer ? `[${langUpper}] ${f.answer}` : '',
          }))
        : []
      : faqs || [];

    const mockContent = includeContent
      ? content
        ? this.cloneTiptapWithTranslatedText(content, (text) => {
            if (!text.trim() || text.length <= 2) return text;
            return `[${langUpper}] ${text}`;
          })
        : { type: 'doc', content: [] }
      : content || { type: 'doc', content: [] };

    return {
      success: true,
      isMock: true,
      translation: {
        title: mockTitle,
        slug: mockSlug,
        excerpt: mockExcerpt,
        content: mockContent as Record<string, unknown>,
        metaTitle: mockMetaTitle,
        metaDescription: mockMetaDesc,
        coverImageAlt: mockCoverAlt,
        faqs: mockFaqs,
      },
      error: `GEMINI_API_KEY not configured. Generated baseline [${langUpper}] translation.`,
    };
  }

  async translateFaqsWithGemini(
    faqs: BlogFAQ[],
    toLang: SupportedLocale,
    apiKey: string,
  ): Promise<BlogFAQ[]> {
    if (!faqs || faqs.length === 0) return [];
    const targetLanguageSpec = LANGUAGE_PROMPTS[toLang] || toLang;

    const payload = {
      contents: [
        {
          parts: [
            {
              text: `You are an expert web localization translator.
Translate the following Frequently Asked Questions (FAQs) from English into ${targetLanguageSpec}.
Rules:
1. Translate both 'question' and 'answer' with native fluency and natural phrasing.
2. Preserve brand names and technical terms.
3. Return ONLY a valid JSON array of objects: [{"question": "...", "answer": "..."}] without markdown backticks.

FAQs to translate:
${JSON.stringify(faqs)}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    };

    for (const model of GEMINI_MODELS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        );
        clearTimeout(timeout);
        if (!res.ok) continue;
        const data = await res.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(candidateText);
        } catch {
          const cleaned = candidateText
            .replace(/^```json\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          parsed = JSON.parse(cleaned);
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .map((item: unknown) => {
              const f = item as Record<string, unknown>;
              return {
                question: String(f.question || '').trim(),
                answer: String(f.answer || '').trim(),
              };
            })
            .filter((f) => f.question || f.answer);
        }
      } catch (err: unknown) {
        this.logger.debug(`Gemini model ${model} failed for FAQs: ${err}`);
        continue;
      }
    }

    return faqs.map((f) => ({
      question: `[${toLang.toUpperCase()}] ${f.question}`,
      answer: `[${toLang.toUpperCase()}] ${f.answer}`,
    }));
  }

  async translateTiptapNodesChunk(
    nodesChunk: Record<string, unknown>[],
    toLang: SupportedLocale,
    apiKey: string,
  ): Promise<Record<string, unknown>[]> {
    if (!nodesChunk || nodesChunk.length === 0) return [];
    const targetLanguageSpec = LANGUAGE_PROMPTS[toLang] || toLang;

    const prompt = `You are a professional web localization expert and polyglot editor.
Translate the human-readable text and image 'alt' attributes in the following Tiptap JSON content nodes from English to ${targetLanguageSpec}.

Strict Translation Rules:
1. Maintain native fluency, idiomatic expressions, and professional copywriting standards.
2. DO NOT translate technical brand names (e.g. TextGenerators, Next.js, Unicode, CSS, HTML, JavaScript).
3. DO NOT translate code identifiers or URLs.
4. Maintain the exact same JSON format, hierarchy, node types (paragraph, heading, bulletList, orderedList, taskList, table, image, codeBlock, etc.), and non-text attributes intact.
5. In codeBlock nodes, preserve the code verbatim without translating.
6. Return ONLY a valid JSON array of translated nodes: [{ ... }] without markdown backticks.

Nodes to translate:
${JSON.stringify(nodesChunk)}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    };

    for (const model of GEMINI_MODELS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35000);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        );
        clearTimeout(timeout);
        if (!res.ok) continue;

        const data = await res.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(candidateText);
        } catch {
          parsed = JSON.parse(
            candidateText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim(),
          );
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as Record<string, unknown>[];
        }
      } catch (err: unknown) {
        this.logger.debug(`Gemini model ${model} failed for node chunk: ${err}`);
        continue;
      }
    }

    return nodesChunk;
  }

  async translateContentInParallel(
    content: Record<string, unknown>,
    toLang: SupportedLocale,
    apiKey: string,
  ): Promise<Record<string, unknown>> {
    const nodes = Array.isArray(content?.content)
      ? (content.content as Record<string, unknown>[])
      : [];

    if (nodes.length === 0) {
      return content || { type: 'doc', content: [] };
    }

    const chunks = this.splitTiptapNodesIntoChunks(nodes, 1500);

    if (chunks.length <= 1) {
      const translatedNodes = await this.translateTiptapNodesChunk(
        chunks[0] || [],
        toLang,
        apiKey,
      );
      return { ...content, content: translatedNodes };
    }

    const translatedChunkResults = await this.asyncMapPool(chunks, 3, (chunk) =>
      this.translateTiptapNodesChunk(chunk, toLang, apiKey),
    );

    return {
      ...content,
      content: translatedChunkResults.flat(),
    };
  }

  async translateMetadataWithGemini(
    title: string,
    slug: string,
    excerpt: string,
    metaTitle: string,
    metaDescription: string,
    coverImageAlt: string,
    toLang: SupportedLocale,
    apiKey: string,
  ) {
    const targetLanguageSpec = LANGUAGE_PROMPTS[toLang] || toLang;

    const prompt = `You are a professional web localization expert and polyglot editor.
Translate the following blog article metadata from English to ${targetLanguageSpec}.

Strict Rules:
1. Maintain native fluency, idiomatic expressions, and professional copywriting standards.
2. DO NOT translate technical brand names (e.g. TextGenerators, Next.js, Unicode, CSS, HTML, JavaScript).
3. Provide a localized, URL-friendly romanized/transliterated slug.
4. Return ONLY a valid JSON object matching the schema below without markdown backticks.

Required JSON Structure:
{
  "title": "localized title",
  "slug": "romanized-url-slug",
  "excerpt": "localized excerpt",
  "metaTitle": "localized meta title",
  "metaDescription": "localized meta description",
  "coverImageAlt": "localized cover image alt text"
}

Metadata to translate:
${JSON.stringify({ title, excerpt, metaTitle, metaDescription, coverImageAlt })}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    };

    for (const model of GEMINI_MODELS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        );
        clearTimeout(timeout);
        if (!res.ok) continue;

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = JSON.parse(
            text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim(),
          );
        }

        const transTitle = String(parsed.title || title).trim();
        const transSlug =
          typeof parsed.slug === 'string' && parsed.slug.trim()
            ? transliterateToSlug(parsed.slug)
            : this.generateCleanSlug(transTitle, slug || 'article', toLang);

        return {
          title: transTitle,
          slug: transSlug,
          excerpt: String(parsed.excerpt || excerpt).trim(),
          metaTitle: String(parsed.metaTitle || metaTitle || transTitle).trim(),
          metaDescription: String(parsed.metaDescription || metaDescription || excerpt).trim(),
          coverImageAlt: String(parsed.coverImageAlt || coverImageAlt).trim(),
        };
      } catch (err: unknown) {
        this.logger.debug(`Gemini model ${model} failed for metadata: ${err}`);
        continue;
      }
    }

    return {
      title,
      slug: this.generateCleanSlug(title, slug || 'article', toLang),
      excerpt,
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || excerpt,
      coverImageAlt,
    };
  }

  async translateArticle(input: TranslateArticleInput): Promise<TranslationResult> {
    const apiKey = this.getGeminiApiKey();

    if (!apiKey) {
      this.logger.warn(`No GEMINI_API_KEY found, using fallback translation for ${input.toLang}`);
      return this.generateMockTranslation(input);
    }

    const {
      title,
      slug,
      excerpt,
      content,
      metaTitle,
      metaDescription,
      coverImageAlt,
      faqs,
      toLang,
      scopes,
    } = input;

    const includeTitle = !scopes || scopes.includes('title');
    const includeContent = !scopes || scopes.includes('content');
    const includeFaqs = !scopes || scopes.includes('faqs');
    const includeSeo = !scopes || scopes.includes('seo');

    const validInputFaqs =
      includeFaqs && Array.isArray(faqs)
        ? faqs
            .map((f) => ({
              question: String(f.question || '').trim(),
              answer: String(f.answer || '').trim(),
            }))
            .filter((f) => f.question || f.answer)
        : [];

    try {
      const [metaResult, translatedFaqs, translatedContent] = await Promise.all([
        includeTitle || includeSeo
          ? this.translateMetadataWithGemini(
              title || '',
              slug || '',
              excerpt || '',
              metaTitle || title || '',
              metaDescription || excerpt || '',
              coverImageAlt || '',
              toLang,
              apiKey,
            )
          : Promise.resolve({
              title: title || '',
              slug: slug || 'article',
              excerpt: excerpt || '',
              metaTitle: metaTitle || title || '',
              metaDescription: metaDescription || excerpt || '',
              coverImageAlt: coverImageAlt || '',
            }),
        includeFaqs && validInputFaqs.length > 0
          ? this.translateFaqsWithGemini(validInputFaqs, toLang, apiKey)
          : Promise.resolve([]),
        includeContent && content
          ? this.translateContentInParallel(content as Record<string, unknown>, toLang, apiKey)
          : Promise.resolve(content || { type: 'doc', content: [] }),
      ]);

      return {
        success: true,
        translation: {
          title: includeTitle ? metaResult.title : title || '',
          slug: includeTitle ? metaResult.slug : slug || 'article',
          excerpt: includeTitle ? metaResult.excerpt : excerpt || '',
          content: includeContent
            ? (translatedContent as Record<string, unknown>)
            : content || { type: 'doc', content: [] },
          metaTitle: includeSeo ? metaResult.metaTitle : metaTitle || title || '',
          metaDescription: includeSeo
            ? metaResult.metaDescription
            : metaDescription || excerpt || '',
          coverImageAlt: includeSeo ? metaResult.coverImageAlt : coverImageAlt || '',
          faqs: includeFaqs ? translatedFaqs : validInputFaqs || [],
        },
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Translation error';
      this.logger.error(`Gemini translation failed: ${errorMsg}`);
      const fallback = this.generateMockTranslation(input);
      return {
        ...fallback,
        error: `AI translation service temporarily unavailable (${errorMsg}). Generated baseline localization.`,
      };
    }
  }

  async batchTranslateArticle(
    input: Omit<TranslateArticleInput, 'toLang'> & { toLangs: SupportedLocale[] },
  ): Promise<{
    translations: Record<string, BlogTranslation>;
    errors: Record<string, string>;
    isMock: boolean;
  }> {
    const translations: Record<string, BlogTranslation> = {};
    const errors: Record<string, string> = {};
    let anyMock = false;

    for (const langCode of input.toLangs) {
      if (langCode === (input.fromLang || 'en')) {
        continue;
      }

      const result = await this.translateArticle({
        ...input,
        toLang: langCode,
      });

      if (result.success && result.translation) {
        translations[langCode] = result.translation;
        if (result.isMock) {
          anyMock = true;
        }
      } else {
        errors[langCode] = result.error || 'Failed to translate';
      }

      if (this.getGeminiApiKey() && input.toLangs.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    return {
      translations,
      errors,
      isMock: anyMock,
    };
  }
}
