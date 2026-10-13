import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // The wallet config lives entirely in URL query params, so a link that
    // drops the query string silently reverts to defaults — and logs the user
    // out, since a config change rebuilds the connector. `ConfigLink` forwards
    // them; this turns forgetting it into a build error rather than something
    // rediscovered months later.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/components/ConfigLink.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                "Use ConfigLink (src/app/components/ConfigLink.tsx) so wallet-config URL params survive navigation.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
