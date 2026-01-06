# roslib-ts

TypeScript-first ROSLIB implementation.

## ✨ Features

✅ WebSocket transport (rosbridge)
✅ Web / React Native compatible
✅ TypeScript first
✅ Event-driven API
❌ No socket.io support
❌ No WebRTC support

## Install

```bash
pnpm add roslib-ts
```

## Usage

```typescript
import { Ros, Topic } from 'roslib-ts'

const ros = new Ros({
  url: 'ws://localhost:9090'
})

ros.on('connection', () => {
  console.log('Connected');
});

ros.on('close', () => {
  console.log('Disconnected');
});

const cmdVel = new Topic({
  ros,
  name: '/cmd_vel',
  messageType: 'geometry_msgs/Twist'
})

cmdVel.subscribe(msg => {
  console.log(msg.linear.x)
})
```




