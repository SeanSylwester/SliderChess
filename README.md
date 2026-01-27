# SliderChess - Client & Server in TypeScript Node.js

An online, real-time, chess variant app. Written in TypeScript with a Node.js Express/WebSockets server and a browser client.
The server sends the list of games to the client, who can either join a game in progress as a player or spectator or create a new game.
You can share the URL of your game room to link people directly to your game, or they can browse for it in the game list.

This was my first webdev project and my first using TypeScript, Node.js, and WebSockets. I only had a vague familiarity with JavaScript before hand. So basically, don't judge me for the code quality and don't use it as a reference ;p 

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

**Browser client:**
Navigate to `http://localhost:3000` in your browser and click the button to fetch data from the server.

## Project Structure

- `src/server/` - Express and WebSockets HTTP server
- `public/index.html` - Browser client
- `tsconfig.json` - TypeScript configuration
- `package.json` - Project dependencies and scripts
