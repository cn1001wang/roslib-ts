# @naviai/roslib-ts

A lightweight TypeScript ROSbridge WebSocket client for browsers, React Native, and other JavaScript runtimes.

[简体中文](./README.zh-CN.md) · [API reference](./API.md)

## Features

- Two entry points: a small compatible client from the package root and an enhanced client from `/next`
- Automatic reconnection with exponential backoff
- Optional heartbeat detection for half-open connections
- Automatic restoration of active topic subscriptions and advertisements after reconnection
- FIFO buffering for messages explicitly sent through the offline queue
- Topic, service, parameter, action, and manager APIs
- TypeScript declarations for all public exports

## Installation

```bash
pnpm add @naviai/roslib-ts
```

Equivalent npm and Yarn commands:

```bash
npm install @naviai/roslib-ts
yarn add @naviai/roslib-ts
```

## Enhanced client

Import from `@naviai/roslib-ts/next` when the application needs reconnection, heartbeat detection, connection states, or manager APIs.

```ts
import {
  Ros,
  RosState,
  TopicManager,
  ServiceManager,
} from '@naviai/roslib-ts/next';

const ros = new Ros({
  url: 'ws://192.168.1.10:9090',
  reconnect_min_delay: 1_000,
  reconnect_max_delay: 30_000,
  heartbeat_interval_ms: 8_000,
});

const topics = new TopicManager(ros);
const services = new ServiceManager(ros);

ros.on('state', (state: RosState) => {
  console.log('ROS state:', state);
});

const handleChatter = (message: { data: string }) => {
  console.log('Received:', message.data);
};

topics.subscribe('/chatter', 'std_msgs/String', handleChatter);

// Rejects while offline unless queueWhenOffline is true.
await topics.publish(
  '/cmd_vel',
  'geometry_msgs/Twist',
  {
    linear: { x: 0.5, y: 0, z: 0 },
    angular: { x: 0, y: 0, z: 0.1 },
  },
  undefined,
  true,
);

const time = await services.call('/rosapi/get_time', 'rosapi/GetTime');
console.log(time);

// Remove this callback. The physical subscription is removed after the last
// callback for the topic is removed.
topics.unsubscribe('/chatter', handleChatter);
```

### Connection behavior

| Situation | Behavior |
| --- | --- |
| Initial connection fails or the socket closes unexpectedly | Reconnects with exponential backoff up to `reconnect_max_delay` |
| An active topic subscription reconnects | Sends `subscribe` again automatically |
| An active publisher reconnects | Sends `advertise` again automatically |
| `ros.close()` is called | Closes intentionally and does not reconnect |
| `callOnConnection(message)` is called while offline | Queues the message and flushes it after connection |
| `TopicManager.publish(..., false)` is called while offline | Rejects without queueing |
| `TopicManager.publish(..., true)` is called while offline | Queues the publish message for the next connection |

Subscriptions and advertisements are connection lifecycle state. They are restored on the `connection` event rather than being duplicated in the offline message queue.

### Connection states

The enhanced client exposes:

```text
IDLE → CONNECTING → CONNECTED
                    ↓
               RECONNECTING

CLOSED: closed explicitly
ERROR: unrecoverable setup error
```

Use `ros.state`, `ros.isConnected`, or the `state` event to observe changes.

## Direct Topic API

Use `Topic` when manager-level sharing is not required:

```ts
import { Ros, Topic } from '@naviai/roslib-ts/next';

const ros = new Ros({ url: 'ws://localhost:9090' });

const chatter = new Topic({
  ros,
  name: '/chatter',
  messageType: 'std_msgs/String',
});

chatter.subscribe((message: { data: string }) => {
  console.log(message.data);
});

chatter.publish({ data: 'hello from roslib-ts' });

// Cleanup when the owner is disposed:
chatter.unsubscribe();
chatter.unadvertise();
```

Direct `Topic.publish()` uses the enhanced client's offline queue. Applications that must not replay stale commands after reconnecting should check `ros.isConnected` before publishing, or use `TopicManager.publish()` with its default `queueWhenOffline = false`.

## Standard client

The package root exports the smaller client without enhanced reconnection and heartbeat management:

```ts
import { Ros, Topic } from '@naviai/roslib-ts';

const ros = new Ros({ url: 'ws://localhost:9090' });
const cmdVel = new Topic({
  ros,
  name: '/cmd_vel',
  messageType: 'geometry_msgs/Twist',
});

cmdVel.publish({
  linear: { x: 0.1, y: 0, z: 0 },
  angular: { x: 0, y: 0, z: 0 },
});
```

## Enhanced client options

| Option | Default | Description |
| --- | ---: | --- |
| `url` | — | Connect immediately to this ROSbridge WebSocket URL |
| `WebSocket` | global `WebSocket` | Custom WebSocket implementation |
| `reconnect_min_delay` | `1000` | Initial reconnect delay in milliseconds |
| `reconnect_max_delay` | `30000` | Maximum reconnect delay in milliseconds |
| `heartbeat_interval_ms` | `0` | Heartbeat interval; `0` disables heartbeat detection |
| `heartbeat_fn` | ROS time service call | Custom heartbeat sender |

When heartbeat detection is enabled and no server message is received for two heartbeat intervals, the client closes the stale socket and starts reconnection.

## API reference

See [API.md](./API.md) for the complete API.

## Contributing

Issues and pull requests are welcome. Before submitting a change:

```bash
pnpm install
pnpm build
```
