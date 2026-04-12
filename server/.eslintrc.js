/**
 * ESLint Configuration - Backend
 */

const globals = require("globals");
const pluginJs = require("@eslint/js");

module.exports = [
  { 
    files: ["**/*.js"],
    ignores: ["node_modules/", "coverage/", "logs/"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 2022,
      sourceType: "commonjs",
    },
  },
  pluginJs.configs.recommended,
  {
    rules: {
      // Node.js specific
      "no-console": ["warn", { 
        allow: ["warn", "error"],
      }],
      "no-unused-vars": ["warn", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
      
      // Best practices
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-with": "error",
      "prefer-const": "error",
      "no-var": "error",
      
      // Error handling
      "no-throw-literal": "error",
      "no-return-assign": "error",
      
      // Security
      "no-path-concat": "error",
    },
  },
];
