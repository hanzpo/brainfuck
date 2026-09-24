# Brainfuck Interpreter

A web-based Brainfuck interpreter with a code editor, step-through execution, a memory tape visualizer, and a terminal for program I/O.

Live at [brainfuck.hanzpo.com](https://brainfuck.hanzpo.com).

## Development

```sh
npm install
npm run dev      # start the dev server
npm run build    # type-check and build to dist/
npm run lint
```

Built with React, TypeScript, Vite, Tailwind CSS, and xterm.js.

## Deployment

Pushes to `main` build the site and deploy it to GitHub Pages via `.github/workflows/deploy.yml`. The custom domain is set by `public/CNAME`.
