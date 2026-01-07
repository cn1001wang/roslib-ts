# roslib-ts API 文档

本文档覆盖以下文件导出的公开 API：
- [EnhancedRos.ts](./src/EnhancedRos.ts)
- [RosManagers.ts](./src/RosManagers.ts)
- [Topic.ts](./src/Topic.ts)
- [Service.ts](./src/Service.ts)
- [Param.ts](./src/Param.ts)
- [next.ts](./src/next.ts)

---

## 入口与导出（next.ts）

文件：[next.ts](./src/next.ts)

### 导出项

- `SimpleRos`：原始轻量 Ros 实现（无增强能力），来自 `./Ros`
- `Ros`：增强版连接实现（EnhancedRos 的默认导出别名）
- `RosState`：增强版连接状态枚举（`EnhancedRosState` 的别名）
- `Topic`：话题 API
- `Service`：服务 API
- `ServiceRequest` / `ServiceResponse`：服务请求/响应容器
- `Param`：参数 API
- `EventEmitter`：简单事件系统
- `TopicManager` / `ServiceManager` / `ParamManager`：可选的管理器封装

---

## EnhancedRos（增强连接封装）

文件：[EnhancedRos.ts](./src/EnhancedRos.ts)

EnhancedRos 是一个面向工程可靠性的 RosBridge WebSocket 封装层：
- 自动重连：指数退避（Exponential Backoff）
- 离线队列：未连接时消息进入 FIFO 队列，连接成功后自动清空发送
- 心跳保活：周期性发送轻量消息；若连续 2 个心跳周期未收到任何服务端消息，强制断开并触发重连
- 资源回收：每次 `connect()` 会清理定时器、关闭旧连接并重置瞬态状态
- 状态机：`IDLE / CONNECTING / CONNECTED / RECONNECTING / CLOSED / ERROR`

### EnhancedRosState（连接状态枚举）

- `IDLE`：空闲/初始状态
- `CONNECTING`：正在连接
- `CONNECTED`：已连接，可发送消息
- `RECONNECTING`：异常断线后正在重连
- `CLOSED`：用户主动关闭，不再自动重连
- `ERROR`：不可恢复错误（例如无 URL 等）

> EnhancedRos 会在状态变化时触发事件：`ros.emit('state', nextState)`

### EnhancedRosOptions（构造参数）

- `url?: string`：默认连接地址，提供则构造时自动连接
- `WebSocket?: typeof WebSocket`：自定义 WebSocket 实现（测试/特殊运行环境）
- `reconnect_min_delay?: number`：首次重连延迟，默认 `1000ms`
- `reconnect_max_delay?: number`：最大重连延迟，默认 `30000ms`
- `heartbeat_interval_ms?: number`：心跳间隔；`<=0` 表示禁用
- `heartbeat_fn?: () => void`：自定义心跳发送函数（可选）；未提供则使用默认心跳策略

### 构造函数

```ts
new EnhancedRos(options?: EnhancedRosOptions)
```

### 属性

- `state: EnhancedRosState`：当前连接语义状态
- `isConnected: boolean`：是否处于 `CONNECTED`

### 方法

- `connect(url: string): void`
  - 建立/切换连接
  - 会清理：重连定时器、心跳定时器、旧 WebSocket、离线队列与瞬态状态
  - 状态迁移：`IDLE -> CONNECTING -> CONNECTED`，异常断线进入 `RECONNECTING`

- `close(): void`
  - 主动关闭连接，不触发自动重连
  - 会清理：重连/心跳定时器、离线队列，并关闭 WebSocket
  - 状态：进入 `CLOSED`

- `callOnConnection(message: any): void`
  - 发送 rosbridge 消息
  - 若非 `CONNECTED`：进入离线队列（FIFO）
  - 连接成功后会自动 flush 队列按顺序发送

- `getNextId(): string`
  - 生成递增字符串 ID，用于 service call 的请求-响应匹配

- `cast(message: any): void`
  - “立即发送”接口（不入队）
  - 仅当 WebSocket `OPEN` 才发送，否则直接返回

### 事件

EnhancedRos 继承自 `EventEmitter`，并对外提供以下关键事件：

- `connection`：WebSocket 连接建立
- `close`：WebSocket 关闭（主动/被动都会触发）
- `error`：WebSocket 错误
- `state`：状态机变化，payload 为 `EnhancedRosState`

此外，EnhancedRos 会将 rosbridge 下行消息按原 Ros 的事件模型分发：

- 话题消息：`emit(topicName, msg)`（当收到 `{ op:'publish', topic, msg }`）
- 服务响应：`emit(id, message)`（当收到 `{ op:'service_response', id, ... }`）
- 状态消息：`emit('status', message)` 或 `emit('status:' + id, message)`
- 服务请求：`emit('service_request:' + serviceName, message)`（用于 `Service.advertise`）

---

## Topic（话题）

文件：[Topic.ts](./src/Topic.ts)

### 构造参数

```ts
new Topic({
  ros,
  name,
  messageType,
  compression?,
  throttle_rate?,
  queue_size?,
  latch?,
  queue_length?,
})
```

字段：
- `ros: RosLike`：可传 `SimpleRos` 或 `EnhancedRos`
- `name: string`：话题名（例：`/chatter`）
- `messageType: string`：消息类型（例：`std_msgs/String`）
- `compression?: string`：压缩方式
- `throttle_rate?: number`：限流（ms）
- `queue_size?: number`：发布队列大小
- `latch?: boolean`：latched topic
- `queue_length?: number`：队列长度

### 方法

- `subscribe(callback?: (message: any) => void): void`
  - 发送 rosbridge `subscribe` 指令
  - 同时监听 `ros.on(name, ...)` 接收消息并触发本 Topic 的 `message` 事件与回调

- `unsubscribe(): void`
  - 发送 rosbridge `unsubscribe` 指令
  - 移除 `ros.off(name)` 监听

- `publish(message: any): void`
  - 若未 advertise 会先 `advertise()`
  - 发送 rosbridge `publish` 指令

- `advertise(): void`
  - 发送 rosbridge `advertise` 指令

- `unadvertise(): void`
  - 发送 rosbridge `unadvertise` 指令

### 事件

- `message`：每次收到消息会 `emit('message', msg)`

---

## Service（服务）

文件：[Service.ts](./src/Service.ts)

### 构造参数

```ts
new Service({ ros, name, serviceType })
```

- `ros: RosLike`
- `name: string`：服务名（例：`/rosapi/get_time`）
- `serviceType: string`：服务类型（例：`rosapi/GetTime`）

### 方法

- `callService(request: ServiceRequest, callback?, failedCallback?): Promise<ServiceResponse>`
  - 生成请求 id：`ros.getNextId()`
  - 发送 rosbridge `call_service`
  - 监听 `ros.on(id, ...)` 等待 `service_response`
  - Promise resolve 为 `ServiceResponse`

- `advertise(callback: (request: ServiceRequest, response: ServiceResponse) => boolean | void): void`
  - 发送 rosbridge `advertise_service`
  - 监听 `ros.on('service_request:' + name, ...)` 处理请求
  - 根据 callback 返回值发送 `service_response`（`result: result !== false`）

- `unadvertise(): void`
  - 发送 rosbridge `unadvertise_service`
  - `ros.off('service_request:' + name)`

---

## ServiceRequest / ServiceResponse

文件：[ServiceRequest.ts](./src/ServiceRequest.ts)

```ts
new ServiceRequest(values?: Record<string, any>)
new ServiceResponse(values?: Record<string, any>)
```

这两个类是轻量对象容器：会把 `values` 的字段拷贝到实例本身上。

---

## Param（参数）

文件：[Param.ts](./src/Param.ts)

### 构造参数

```ts
new Param({ ros, name })
```

- `ros: RosLike`
- `name: string`：参数名（例：`/demo_param`）

### 方法

- `get(callback?): Promise<any>`
  - 调用 `/rosapi/get_param`（`rosapi/GetParam`）
  - resolve 为 `response.value`

- `set(value: any, callback?): Promise<void>`
  - 调用 `/rosapi/set_param`（`rosapi/SetParam`）
  - value 会在内部 `JSON.stringify(value)`

- `delete(callback?): Promise<void>`
  - 调用 `/rosapi/delete_param`（`rosapi/DeleteParam`）

---

## RosManagers（可选管理器封装）

文件：[RosManagers.ts](./src/RosManagers.ts)

这些 Manager 是业务侧便利封装，依赖 `EnhancedRos`。

### TopicManager

用途：
- 对同名 topic 进行集中管理
- 同一个 topic 多个回调时只创建/订阅一次 Topic

构造：
```ts
new TopicManager(ros: EnhancedRos)
```

方法：
- `subscribe(name: string, messageType: string, callback: (msg:any)=>void): void`
- `unsubscribe(name: string, callback?: (msg:any)=>void): void`
- `publish(name: string, messageType: string, data: any): void`
- `clearAll(): void`
- `resubscribeAll(ros: any): void`

### ServiceManager

用途：为 service call 增加统一超时控制

构造：
```ts
new ServiceManager(ros: EnhancedRos, timeoutMs = 10000)
```

方法：
- `call(name: string, serviceType: string, request?: any, timeoutMs = defaultTimeout): Promise<any>`

### ParamManager

用途：为参数 get/set/delete 提供统一超时与错误包装

构造：
```ts
new ParamManager(ros: EnhancedRos, timeoutMs = 10000)
```

方法：
- `get(name: string, timeoutMs = defaultTimeout): Promise<any>`
- `set(name: string, value: any): Promise<void>`
- `delete(name: string): Promise<void>`

