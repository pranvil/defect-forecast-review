# DRP Web Client

## 启动（联调后端）

```bash
cd c:\code\DRP\defect-forecast-web
copy .env.example .env    # 只在第一次创建 .env 时需要。
npm install  #只在第一次、或你/同事更新了依赖（package.json / lockfile 变了）、或删了 node_modules 才需要再跑
npm run dev
```
后端：在 c:\code\DRP\export-service 跑 uvicorn app.main:app --port 8000（或你实际用的端口）

默认会调用 `http://127.0.0.1:8000`，可在 `.env` 中调整：

- `VITE_API_BASE_URL`: 后端地址
- `VITE_USE_MOCK`: 是否强制使用 mock（默认 `false`）
- `VITE_REVIEW_MODE`: 评审模式（默认 `false`）

## 说明

- `VITE_USE_MOCK=false` 时，Jira/历史/预测/版本/对比、团队配置、字段映射、预测默认参数都会走后端真实 API。
- `JIRA 数据获取` 会使用“系统配置”页保存的 Jira 连接参数（PAT/Basic）。
- Excel 导出使用 `VITE_API_BASE_URL` 指向同一后端，不再硬编码本机地址。
- `VITE_USE_MOCK=true` 时继续走 mock service，方便离线开发。

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
