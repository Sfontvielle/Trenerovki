// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/design-system/tokens.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/], Literal[value=/^rgba?\\(/]',
          message: 'Use a color from src/design-system/tokens.ts.',
        },
        {
          selector:
            "Property[key.name=/^(padding|margin|gap)(Top|Bottom|Left|Right|Horizontal|Vertical)?$/][value.type='Literal']",
          message: 'Use a spacing token from src/design-system/tokens.ts.',
        },
      ],
    },
  },
]);
