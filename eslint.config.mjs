// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // ── Overrides for pragmatic strictness ──

      // Allow explicit `any` in adapter/glue code (IB API types are loose)
      '@typescript-eslint/no-explicit-any': 'warn',

      // Allow unused vars when prefixed with _
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Relax for event-driven IB patterns using `.on()` / `.once()`
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',

      // Allow non-null assertions sparingly (IB API guarantees)
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Restrict floating promises (must be awaited or void-returned)
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Prefer nullish coalescing and optional chaining
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'error',

      // Consistent type imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Allow async functions that don't await (common in MCP handlers)
      '@typescript-eslint/require-await': 'off',

      // Allow template expressions with any types (logging)
      '@typescript-eslint/restrict-template-expressions': 'warn',

      // Defensive optional chaining / nullish coalescing on IB API values is OK
      '@typescript-eslint/no-unnecessary-condition': 'warn',

      // IB API returns loose types; restrict-plus-operands too strict
      '@typescript-eslint/restrict-plus-operands': 'warn',

      // Allow `void` in type unions for queue patterns
      '@typescript-eslint/no-invalid-void-type': 'off',

      // Allow catch callbacks with `any` (IB error shapes vary)
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'warn',

      // Allow require() for optional native deps
      '@typescript-eslint/no-require-imports': 'warn',

      // `no-base-to-string` too strict for IB status objects
      '@typescript-eslint/no-base-to-string': 'warn',

      // Allow deprecated APIs (Server vs McpServer) until SDK stabilises
      '@typescript-eslint/no-deprecated': 'warn',

      // No console in production code — use logger
      'no-console': 'error',
    },
  },
  {
    // Test files get relaxed rules
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'scripts/**', '*.mjs', '*.js'],
  },
);
