# @naviai/roslib-ts

一个轻量的 TypeScript ROSbridge WebSocket 客户端，适用于浏览器、React Native 及其他 JavaScript 运行环境。

[English](./README.md) · [API 手册](./API.md)

## 特性

- 双入口：包根路径提供轻量兼容实现，`/next` 提供增强实现
- 指数退避自动重连
- 可选的应用层心跳检测，用于发现“假在线”连接
- 重连后自动恢复仍然有效的 Topic 订阅和发布者公告
- 对明确需要离线补发的消息提供 FIFO 队列
- 支持 Topic、Service、Param、Action 及 Manager API
- 为所有公开导出提供 TypeScript 类型声明

## 安装

```bash
pnpm add @naviai/roslib-ts
```

也可以使用 npm 或 Yarn：

```bash
npm install @naviai/roslib-ts
yarn add @naviai/roslib-ts
```

## 增强版客户端

业务需要自动重连、心跳检测、连接状态或 Manager API 时，从 `@naviai/roslib-ts/next` 导入：

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
  console.log('ROS 状态：', state);
});

const handleChatter = (message: { data: string }) => {
  console.log('收到消息：', message.data);
};

topics.subscribe('/chatter', 'std_msgs/String', handleChatter);

// queueWhenOffline 默认为 false，离线发布会 reject；
// 这里传 true，表示允许连接恢复后补发。
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

// 移除指定回调；同一 Topic 的最后一个回调被移除后，
// 才会执行底层 unsubscribe。
topics.unsubscribe('/chatter', handleChatter);
```

### 连接行为

| 场景 | 行为 |
| --- | --- |
| 首次连接失败或 WebSocket 异常关闭 | 按指数退避自动重连，间隔最大为 `reconnect_max_delay` |
| 存在有效 Topic 订阅时重连成功 | 自动重新发送 `subscribe` |
| 存在有效发布者时重连成功 | 自动重新发送 `advertise` |
| 主动调用 `ros.close()` | 主动关闭，不再自动重连 |
| 离线调用 `callOnConnection(message)` | 消息进入队列，连接成功后按顺序发送 |
| 离线调用 `TopicManager.publish(..., false)` | 直接 reject，不进入队列 |
| 离线调用 `TopicManager.publish(..., true)` | 发布消息进入队列，连接成功后补发 |

订阅和发布者公告属于连接生命周期状态：连接成功时根据当前业务意图恢复，不会同时重复写入离线消息队列。

### 连接状态

增强版客户端包含以下状态：

```text
IDLE → CONNECTING → CONNECTED
                    ↓
               RECONNECTING

CLOSED：主动关闭
ERROR：不可恢复的初始化错误
```

可以通过 `ros.state`、`ros.isConnected` 或 `state` 事件观察状态变化。

## 直接使用 Topic

不需要 Manager 共享同名 Topic 时，可以直接创建 `Topic`：

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

// 所属组件或模块销毁时释放资源：
chatter.unsubscribe();
chatter.unadvertise();
```

直接调用 `Topic.publish()` 会使用增强连接的离线队列。如果业务不能接受重连后补发过期控制指令，应在发布前检查 `ros.isConnected`，或者使用默认 `queueWhenOffline = false` 的 `TopicManager.publish()`。

## 标准版客户端

包根路径导出轻量客户端，不包含增强版的自动重连和心跳管理：

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

## 增强版配置

| 配置项 | 默认值 | 说明 |
| --- | ---: | --- |
| `url` | — | 构造后立即连接的 ROSbridge WebSocket 地址 |
| `WebSocket` | 全局 `WebSocket` | 自定义 WebSocket 实现 |
| `reconnect_min_delay` | `1000` | 首次重连间隔，单位毫秒 |
| `reconnect_max_delay` | `30000` | 最大重连间隔，单位毫秒 |
| `heartbeat_interval_ms` | `0` | 心跳间隔；`0` 表示关闭心跳检测 |
| `heartbeat_fn` | ROS 时间服务调用 | 自定义心跳发送函数 |

开启心跳后，如果连续两个心跳周期没有收到任何服务端消息，客户端会关闭失效连接并进入自动重连。

## API 手册

完整 API 见 [API.md](./API.md)。

## 贡献

欢迎提交 Issue 和 Pull Request。提交改动前请运行：

```bash
pnpm install
pnpm build
```
