# roslib-ts

🚀 **TypeScript-first ROSLIB implementation.** A lightweight, robust ROSbridge Web client designed for modern frontend engineering.

## ✨ Features

* ✅ **Dual Entrypoints**: Support for Standard (compatible) and `Next` (Production-ready) versions.
* ✅ **Self-healing Connections**: `Next` version features exponential backoff reconnection and application-level heartbeat detection.
* ✅ **Offline Message Queueing**: Messages sent while offline are queued and auto-flushed upon reconnection.
* ✅ **Lifecycle Management**: `TopicManager` with reference counting for automatic sub/unsub and resource cleanup.
* ✅ **100% TypeScript**: Full interface support with perfect type inference and generics.

---

## 📦 Install

```bash
# Install stable version
pnpm add roslib-ts

# Install the latest enhanced version (Beta)
pnpm add roslib-ts@beta

```

---

## 🚀 Quick Start

### 1. Using Next Version (Recommended for Production)

Import via sub-path `/next`. This version is designed to handle network instability.

```typescript
import { Ros, TopicManager, ServiceManager } from 'roslib-ts/next';

// Initialize enhanced connection
const ros = new Ros({
  url: 'ws://192.168.1.10:9090',
  heartbeat_interval_ms: 5000, // 5s heartbeat
  reconnect_min_delay: 1000    // Exponential backoff
});

// Use Managers for simplified operations
TopicManager.subscribe('/chatter', 'std_msgs/String', (msg) => {
  console.log('Received:', msg.data);
});

// Publish messages (Automatic queueing if disconnected)
TopicManager.public('/cmd_vel', 'geometry_msgs/Twist', { linear: { x: 0.5 }, angular: { z: 0.1 } });

```

### 2. Using Standard Version

For simple use cases requiring basic ROSbridge wrapping.

```typescript
import { Ros, Topic } from 'roslib-ts';

const ros = new Ros({ url: 'ws://localhost:9090' });
const cmdVel = new Topic({
  ros,
  name: '/cmd_vel',
  messageType: 'geometry_msgs/Twist'
});

cmdVel.publish({ linear: { x: 0.1 }, angular: { z: 0 } });

```

---

## 🛠 Philosophy

* **State Machine Isolation**: Underlying connections are abstracted into strict states like `IDLE`, `CONNECTED`, `RECONNECTING`.
* **Offline Barrier**: Use `messageQueue` to shield business logic from network instability. No `if(isConnected)` checks needed.
* **Resource Transparency**: Managers handle `advertise` declarations automatically. Physical `unsubscribe` is executed only when the last callback is removed.

---

## 📖 API Reference

More see [API.md](./API.md)

---

## 🤝 Contribution

Issues and Pull Requests are welcome.

---
