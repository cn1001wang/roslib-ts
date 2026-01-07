# roslib-ts

🚀 **TypeScript 优先的 ROSLIB 实现。** 轻量级、健壮且专为现代前端工程设计的 ROSbridge Web 客户端。

## ✨ 特性

* ✅ **双版本入口**：提供标准版（兼容型）与 `Next` 增强版（生产级）。
* ✅ **连接自愈**：`Next` 版本内置指数退避重连与应用层心跳侦测，解决“假在线”痛点。
* ✅ **离线指令队列**：断网时发送的消息自动缓存，并在连接恢复后按序补发。
* ✅ **自动化管理**：`TopicManager` 提供引用计数，自动处理订阅与资源回收。
* ✅ **100% TypeScript**：全接口支持，提供完美的类型推导与泛型定义。

---

## 📦 安装

```bash
# 安装稳定版
pnpm add roslib-ts

# 体验最新增强版 (Beta)
pnpm add roslib-ts@beta

```

---

## 🚀 快速开始

### 1. 使用增强版 (推荐用于生产环境)

通过子路径 `/next` 导入。该版本解决了网络波动导致的指令丢失问题。

```typescript
import { Ros, TopicManager, ServiceManager } from 'roslib-ts/next';

// 初始化连接
const ros = new Ros({
  url: 'ws://192.168.1.10:9090',
  heartbeat_interval_ms: 5000, // 5秒心跳检测
  reconnect_min_delay: 1000    // 指数退避重连
});

// 初始化 TopicManager 与 ServiceManager
const topicManager = new TopicManager(ros);
const serviceManager = new ServiceManager(ros);

// 使用 Manager 直接操作，无需手动维护 Topic 实例
topicManager.subscribe('/chatter', 'std_msgs/String', (msg) => {
  console.log('收到数据:', msg.data);
});

// 发布消息 (即使连接未建立也会自动排队)
topicManager.public('/cmd_vel', 'geometry_msgs/Twist', { linear: { x: 0.5 }, angular: { z: 0.1 } });

```

### 2. 使用标准版 (基础功能)

如果你只需要最基础的 ROSbridge 封装，可以使用标准入口。

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

## 🛠 设计思想

* **状态机隔离**：底层连接被抽象为 `IDLE`, `CONNECTED`, `RECONNECTING` 等严格状态，确保复杂网络下的行为可预测。
* **离线屏障**：通过 `messageQueue` 屏蔽物理连接的不稳定性。业务层调用 `publish` 时，不需判断 `isConnected`。
* **资源透明**：Manager 自动处理 `advertise` 声明。当最后一个订阅回调移除时，底层自动执行 `unsubscribe` 以节省资源。

---

## 📖 API 手册

更多见 [API.md](./API.md)

---

## 🤝 贡献与反馈

欢迎提交 Issue 或 PR。

---
