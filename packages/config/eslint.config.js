import tseslint from "typescript-eslint";

export const STRICT_TYPESCRIPT_RULES = {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      ignoreRestSiblings: true
    }
  ],
  "@typescript-eslint/no-non-null-assertion": "error",
  "@typescript-eslint/consistent-type-imports": [
    "error",
    { prefer: "type-imports", fixStyle: "inline-type-imports" }
  ],
  "@typescript-eslint/no-unused-expressions": "error",
  "eqeqeq": ["error", "always"],
  "no-console": ["warn", { allow: ["warn", "error"] }],
  "prefer-const": "error",
  "no-var": "error"
};

const config = tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/*.config.{js,ts,mjs,cjs}",
      "**/wrangler.toml",
      "**/next-env.d.ts"
    ]
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic
    ],
    rules: { ...STRICT_TYPESCRIPT_RULES }
  },
  {
    files: ["**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
);

export default config;
