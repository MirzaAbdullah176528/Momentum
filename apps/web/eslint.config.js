import { FlatCompat } from "@eslint/eslintrc";
import nextPlugin from "@next/eslint-plugin-next";
import baseConfig, { STRICT_TYPESCRIPT_RULES } from "@momentum/config/eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const nextRules = {
  ...nextPlugin.configs.recommended.rules,
  ...nextPlugin.configs["core-web-vitals"].rules
};

export default [
  ...compat.extends("next/core-web-vitals"),
  ...baseConfig,
  {
    plugins: {
      "@next/next": nextPlugin,
      next: nextPlugin
    },
    rules: {
      ...nextRules,
      ...STRICT_TYPESCRIPT_RULES
    }
  }
];
