import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // REDESIGN-P2 §1.6: components/ui + shared moved to modules/ui.
    "no-restricted-imports": ["error", {
      patterns: [
        {
          group: ["@/components/ui", "@/components/ui/*", "@/components/shared", "@/components/shared/*"],
          message: "Moved to @/modules/ui — import from there.",
        },
      ],
    }],
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    
    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    // set-state-in-effect is overly strict for the common pattern of
    // setLoading(true) followed by an async fetch. Downgrade to warning.
    "react-hooks/set-state-in-effect": "warn",
    "react-hooks/static-components": "warn",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    
    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",
    
    // General JavaScript rules
    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  // REDESIGN-P2 §1.6 — rebuilt modules stay clean:
  //   no legacy examiner deps, no deep imports into other modules
  //   (public API via index.ts; modules/ui deep imports allowed — shadcn kit).
  // Extend the files list as each module is rebuilt.
  files: ["src/modules/{ui,shell,auth,theme,learner-portal,tutor}/**/*"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        {
          group: ["@/components/ui", "@/components/ui/*", "@/components/shared", "@/components/shared/*"],
          message: "Moved to @/modules/ui — import from there.",
        },
        {
          group: ["@/components/examiner", "@/components/examiner/*"],
          message: "Rebuilt modules must not depend on legacy examiner components.",
        },
        {
          regex: "^@/modules/(?!ui(?:/|$))[^\"']*/",
          message: "Import the module's public API (@/modules/<name>) instead of deep paths.",
        },
      ],
    }],
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills"]
}];

export default eslintConfig;
