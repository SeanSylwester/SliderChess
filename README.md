# Hello World TypeScript - Client & Server

A simple TypeScript application with an Express server and Node.js/browser client.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Compile TypeScript:
```bash
npm run build
```

## Running

**Start the server:**
```bash
npm start
```

Or with hot reload:
```bash
npm run dev
```

**Run the Node.js client (in another terminal):**
```bash
npm run client
```

**Browser client:**
Navigate to `http://localhost:3000` in your browser and click the button to fetch data from the server.

## Project Structure

- `src/server.ts` - Express HTTP server
- `src/client.ts` - Node.js HTTP client
- `public/index.html` - Browser client
- `tsconfig.json` - TypeScript configuration
- `package.json` - Project dependencies and scripts
