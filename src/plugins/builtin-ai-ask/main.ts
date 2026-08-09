/*
 * Author: Jamius Siam
 * Since: 18/06/2026
 */
import type { AskPlugin, FetchPlugin, PluginContext } from "../../@types/plugin.ts";
import { getPluginTimeout } from "../../utils.ts";

const SYSTEM_PROMPT =
  "You answer the user's question using only the provided web page content. " +
  "Reply with just the answer, with no preamble and without " +
  "restating the question. If the content does not contain the answer, say so plainly.";

type AiProvider = "openai" | "anthropic" | "ollama" | "openrouter";

function isAiProvider(value: string): value is AiProvider {
  return (
    value === "openai" || value === "anthropic" || value === "ollama" || value === "openrouter"
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing \`${name}\` environment variable.`);
  }
  return value;
}

async function buildModel(provider: AiProvider, modelName: string) {
  switch (provider) {
    case "openai": {
      const apiKey = requireEnv("OPENAI_API_KEY");
      const { createOpenAI } = await import("@ai-sdk/openai");
      return createOpenAI({ apiKey })(modelName);
    }
    case "anthropic": {
      const apiKey = requireEnv("ANTHROPIC_API_KEY");
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic({ apiKey })(modelName);
    }
    case "openrouter": {
      const apiKey = requireEnv("OPENROUTER_API_KEY");
      const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
      return createOpenRouter({ apiKey })(modelName);
    }
    case "ollama": {
      const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/api";
      const { createOllama } = await import("ollama-ai-provider-v2");
      return createOllama({ baseURL })(modelName);
    }
  }
}

async function askFn(src: string, query: string, context: PluginContext): Promise<string> {
  const fetchPlugin = context.configuredPlugins.fetch as FetchPlugin | undefined;
  if (!fetchPlugin) {
    throw new Error(
      "No `fetch` plugin configured. The `ask` plugin reads the URL through the configured " +
        "fetch plugin — set `plugins.fetch` in `~/.config/sibyl/config.json`.",
    );
  }

  const provider = (process.env.SIBYL_AI_PROVIDER ?? "").trim().toLowerCase();
  if (!isAiProvider(provider)) {
    throw new Error(
      "Missing or invalid `SIBYL_AI_PROVIDER` environment variable. " +
        "Expected one of: openai, anthropic, ollama, openrouter.",
    );
  }

  const modelName = process.env.SIBYL_MODEL_NAME?.trim();
  if (!modelName) {
    throw new Error("Missing `SIBYL_MODEL_NAME` environment variable.");
  }

  const model = await buildModel(provider, modelName);

  let content: string;
  try {
    content = (await fetchPlugin.fn(src, context)).trim();
  } catch (err) {
    throw new Error(
      `Failed to fetch \`${src}\` using the configured fetch plugin \`${fetchPlugin.name}\`: ${err}`,
      { cause: err },
    );
  }

  if (!content) {
    throw new Error(`No content fetched from: ${src}`);
  }

  const { generateText } = await import("ai");

  try {
    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: `Web page content:\n\n${content}\n\nQuestion: ${query}`,
      abortSignal: AbortSignal.timeout(getPluginTimeout("ask")),
    });

    return text.trim();
  } catch (err) {
    throw new Error(
      `AI provider \`${provider}\` failed to answer ` +
        `(is it reachable and is \`${modelName}\` a valid model?): ${err}`,
      { cause: err },
    );
  }
}

export const SilbylPlugin: AskPlugin = {
  name: "builtin-ai-ask",
  type: "ask",
  fn: askFn,
};
