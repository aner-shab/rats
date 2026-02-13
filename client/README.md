# Client

This folder contains the browser client for the rats project. To run locally:

1. Install TypeScript if you haven't:
   ```sh
   npm install -g typescript
   ```
2. Compile the TypeScript files:
   ```sh
   npx tsc
   ```
3. Serve the client directory (for example, with `serve` or `http-server`):
   ```sh
   npx serve .
   # or
   npx http-server .
   ```
4. Open `http://localhost:3000` (or the port shown) in your browser.

Make sure your imports in TypeScript use relative paths and do not include file extensions.
