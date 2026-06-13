## Contribution

During development, you can run the CLI with these commands:

```bash
pnpm dev search "react"               # shows search results for "react"
pnpm dev fetch https://react.dev      # fetches the website's content from the URL
pnpm dev --help                       # show help
pnpm dev --version                    # show version
```

Or build and run the compiled binary:

```bash
pnpm build
pnpm start run
```

The entrypoint for Sibyl is located in `src/cli.ts`.\
The plugin loading mechanism is located in `src/plugin-loader.ts`.

### Scripts

| Script               | Description                          |
| -------------------- | ------------------------------------ |
| `pnpm dev`           | Run the CLI from source via tsx.     |
| `pnpm build`         | Compile `src` → `dist`.              |
| `pnpm start`         | Run the compiled CLI.                |
| `pnpm typecheck`     | Type-check with `tsc --noEmit`.      |
| `pnpm lint`          | Lint with ESLint.                    |
| `pnpm format`        | Format with Prettier.                |
| `pnpm test`          | Run the test suite once with Vitest. |
| `pnpm test:watch`    | Run Vitest in watch mode.            |
| `pnpm test:coverage` | Run tests with a coverage report.    |
