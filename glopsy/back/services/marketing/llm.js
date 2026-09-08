import axios from 'axios';

const API_KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const BASE_URL = (process.env.LLM_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const MODEL = process.env.LLM_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || process.env.DEEPSEEK_TIMEOUT_MS) || 8000;

export const llmConfigured = () => Boolean(API_KEY);

const stripCodeFences = (text) => String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

const parseJsonLoose = (text) => {
  try {
    return JSON.parse(stripCodeFences(text));
  } catch {
    const match = stripCodeFences(text).match(/[{[][\s\S]*?[}\]]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const chat = async ({ system, user, json = false, maxTokens = 700 }) => {
  if (!API_KEY) return null;
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });
  try {
    const { data } = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: TIMEOUT_MS,
      }
    );
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    if (json) return parseJsonLoose(content);
    return content.trim();
  } catch (err) {
    console.warn(`[marketing-llm] fallback a reglas (${err.code || err.message || 'error'})`);
    return null;
  }
};

export const askJson = (system, user, opts) => chat({ system, user, json: true, ...opts });
export const askText = (system, user, opts) => chat({ system, user, ...opts });
