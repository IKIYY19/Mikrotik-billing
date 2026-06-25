/**
 * ESLint Configuration - Frontend
 */

import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";

export default [
  { files: ["**/*.{js,jsx}"] },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  pluginJs.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // React rules
      "react/prop-types": "off", // Using prop-types would be nice but not enforced
      "react/react-in-jsx-scope": "off", // Not needed in React 17+
      "react/jsx-no-target-blank": "warn",
      "react/no-unescaped-entities": "warn",
      
      // General rules
      "no-unused-vars": ["warn", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "no-console": ["warn", { 
        allow: ["warn", "error"],
      }],
      "prefer-const": "error",
      "no-var": "error",
      
      // Best practices
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-with": "error",
    },
  },
];
