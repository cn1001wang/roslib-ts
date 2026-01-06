/**
 * 事件发射器，用于内部实现
 */
import EventEmitter from './EventEmitter';
/**
 * ROS 接口定义，保证与原生 roslib 兼容
 */
import type { RosLike } from './Ros';

/**
 * 连接状态枚举
 */
export enum EnhancedRosState {
  /** 空闲/初始状态 */
  IDLE = 'IDLE',
  /** 正在连接 */
  CONNECTING = 'CONNECTING',
  /** 已连接 */
  CONNECTED = 'CONNECTED',
  /** 正在重连 */
  RECONNECTING = 'RECONNECTING',
  /** 已手动关闭 */
  CLOSED = 'CLOSED',
  /** 发生错误 */
  ERROR = 'ERROR',
}

/**
 * 构造参数
 */
export interface EnhancedRosOptions {
  /** 默认连接地址 */
  url?: string;
  /** 自定义 WebSocket 实现（用于测试或特殊环境） */
  WebSocket?: typeof WebSocket;
  /** 首次重连延迟（毫秒） */
  reconnect_min_delay?: number;
  /** 最大重连延迟（毫秒） */
  reconnect_max_delay?: number;
  /** 心跳间隔（毫秒，≤0 则关闭心跳） */
  heartbeat_interval_ms?: number;
  /** 心跳函数（默认发送 ping 消息） */
  heartbeat_fn?: () => void;
}

/**
 * 增强版 ROS 连接封装
 * 支持自动重连、心跳保活、消息队列、状态管理
 */
export default class EnhancedRos extends EventEmitter implements RosLike {
  /** WebSocket 实例 */
  private socket: WebSocket | null = null;
  /** 自增 ID 计数器，用于请求-响应匹配 */
  private idCounter = 0;

  /** 用户配置副本 */
  private options: EnhancedRosOptions;
  /** 当前连接状态 */
  private _state: EnhancedRosState = EnhancedRosState.IDLE;
  /** 当前/最近一次连接地址 */
  private currentUrl: string | null = null;

  /** 离线消息队列，连接成功后自动发送 */
  private messageQueue: any[] = [];
  /** 重连定时器句柄 */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** 本次重连等待时长（动态退避） */
  private reconnectDelayMs: number;
  /** 最小重连延迟（配置值,默认1s） */
  private readonly reconnectMinDelayMs: number;
  /** 最大重连延迟（配置值,默认30s） */
  private readonly reconnectMaxDelayMs: number;

  /** 心跳定时器句柄 */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  /** 心跳间隔（配置值,默认0s不启用） */
  private readonly heartbeatIntervalMs: number;
  /** 心跳函数（默认发送 ping 消息） */
  private readonly heartbeatFn?: () => void;
  /** 最近一次收到服务端消息的时间戳 */
  private lastServerMessageAtMs: number | null = null;

  /** 标记是否为用户主动关闭（影响重连策略） */
  private manualClose = false;
  /** 连接代际，用于丢弃过期的重连任务 */
  private connectGeneration = 0;

  /**
   * 构造函数
   * @param options 配置项
   */
  constructor(options: EnhancedRosOptions = {}) {
    super();
    this.options = options;

    // 初始化重连退避参数
    this.reconnectMinDelayMs = options.reconnect_min_delay ?? 1000;
    this.reconnectMaxDelayMs = options.reconnect_max_delay ?? 30000;
    this.reconnectDelayMs = this.reconnectMinDelayMs;

    // 初始化心跳参数 开启的话12000ms，不开启0ms
    this.heartbeatIntervalMs = options.heartbeat_interval_ms ?? 0;
    this.heartbeatFn = options.heartbeat_fn;

    // 如果提供了 url，立即开始连接
    if (options.url) {
      this.connect(options.url);
    }
  }

  /** 获取当前状态 */
  get state(): EnhancedRosState {
    return this._state;
  }

  /** 是否已连接 */
  get isConnected(): boolean {
    return this._state === EnhancedRosState.CONNECTED;
  }

  /**
   * 建立连接（如已连接相同地址则忽略）
   * @param url WebSocket 地址，例如 ws://localhost:9090
   */
  connect(url: string): void {
    // 避免重复连接相同地址
    if (
      this.currentUrl === url &&
      (this._state === EnhancedRosState.CONNECTING || this._state === EnhancedRosState.CONNECTED)
    ) {
      return;
    }

    // 进入新一轮连接生命周期
    this.connectGeneration += 1;
    this.cleanupForConnect();
    this.currentUrl = url;
    this.manualClose = false;
    this.setState(EnhancedRosState.IDLE);
    this.setState(EnhancedRosState.CONNECTING);
    this.openSocket(url);
  }

  /**
   * 手动关闭连接（不会触发自动重连）
   */
  close(): void {
    this.connectGeneration += 1;
    this.manualClose = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.messageQueue = [];
    this.setState(EnhancedRosState.CLOSED);
    this.closeSocket();
  }

  /**
   * 发送消息（离线时自动入队）
   * @param message 任意 JSON 兼容对象
   */
  callOnConnection(message: any): void {
    if (this._state !== EnhancedRosState.CONNECTED || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      return;
    }

    this.send(message);
  }

  /**
   * 获取下一个自增 ID（字符串形式）
   */
  getNextId(): string {
    return (++this.idCounter).toString();
  }

  /* ===================== 私有方法 ===================== */

  /** 状态变更并对外广播 */
  private setState(next: EnhancedRosState): void {
    if (this._state === next) return;
    this._state = next;
    this.emit('state', next);
  }

  /** 连接前清理资源 */
  private cleanupForConnect(): void {
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.closeSocket();
    this.messageQueue = [];
    this.reconnectDelayMs = this.reconnectMinDelayMs;
    this.lastServerMessageAtMs = null;
  }

  /** 清除重连定时器 */
  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  /** 创建并绑定 WebSocket 事件 */
  private openSocket(url: string): void {
    try {
      const WS = this.options?.WebSocket ?? WebSocket;
      this.socket = new WS(url);

      this.socket.onopen = () => {
        // 连接成功，重置退避
        this.reconnectDelayMs = this.reconnectMinDelayMs;
        this.lastServerMessageAtMs = Date.now();
        this.setState(EnhancedRosState.CONNECTED);
        this.emit('connection');
        this.startHeartbeat();
        this.flushQueue();
      };

      this.socket.onclose = () => {
        this.stopHeartbeat();
        this.socket = null;
        this.emit('close');

        if (this.manualClose) {
          // 用户主动关闭，不再重连
          this.setState(EnhancedRosState.CLOSED);
          return;
        }

        // 异常断开，进入重连逻辑
        this.setState(EnhancedRosState.RECONNECTING);
        this.scheduleReconnect();
      };

      this.socket.onerror = (error) => {
        this.emit('error', error);
        if (!this.manualClose && this._state === EnhancedRosState.CONNECTING) {
          // 连接阶段出错，准备重连
          this.setState(EnhancedRosState.RECONNECTING);
        }
      };

      this.socket.onmessage = (event) => {
        this.lastServerMessageAtMs = Date.now();
        this.handleMessage(event.data);
      };
    } catch (error) {
      this.emit('error', error);
      this.setState(EnhancedRosState.ERROR);
    }
  }

  /** 安全关闭 WebSocket */
  private closeSocket(): void {
    if (!this.socket) return;
    try {
      this.socket.close();
    } finally {
      this.socket = null;
    }
  }

  /** 调度下一次重连（退避策略，达到最大后固定） */
  private scheduleReconnect(): void {
    if (!this.currentUrl) {
      this.setState(EnhancedRosState.ERROR);
      return;
    }

    const generation = this.connectGeneration;
    const delayMs = this.reconnectDelayMs;
    this.clearReconnectTimer();

    this.reconnectTimer = setTimeout(() => {
      if (this.manualClose) return;
      if (generation !== this.connectGeneration) return; // 连接已过期
      if (this._state !== EnhancedRosState.RECONNECTING) return;
      if (!this.currentUrl) {
        this.setState(EnhancedRosState.ERROR);
        return;
      }

      // 退避：下次等待时间翻倍，直到上限后固定
      this.setState(EnhancedRosState.CONNECTING);
      this.openSocket(this.currentUrl);
      if (this.reconnectDelayMs < this.reconnectMaxDelayMs) {
        this.reconnectDelayMs = Math.min(this.reconnectMaxDelayMs, this.reconnectDelayMs * 2);
      }
      // 已达上限，保持最大延迟不变，持续重试
    }, delayMs);
  }

  /** 启动心跳定时器 */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    if (this.heartbeatIntervalMs <= 0) return;

    this.heartbeatTimer = setInterval(() => {
      if (this._state !== EnhancedRosState.CONNECTED) return;
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

      const now = Date.now();
      const last = this.lastServerMessageAtMs;
      // 超过两倍心跳间隔未收到消息，认为连接失效
      if (last && now - last > this.heartbeatIntervalMs * 2) {
        this.setState(EnhancedRosState.RECONNECTING);
        try {
          this.socket.close();
        } catch {}
        if (!this.reconnectTimer) {
          this.scheduleReconnect();
        }
        return;
      }

      // 发送 ping 保活
      if(this.heartbeatFn) {
        this.heartbeatFn();
      } else {
        /// 默认心跳：调用 /rosapi/get_time 服务
        this.cast({op: "call_service", id: this.getNextId(), service: "/rosapi/get_time", type: "rosapi/GetTime", args: {}});
      }
    }, this.heartbeatIntervalMs);
  }

  /** 停止心跳定时器 */
  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  /** 将离线队列全部发出 */
  private flushQueue(): void {
    if (this._state !== EnhancedRosState.CONNECTED || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (this.messageQueue.length === 0) return;

    const pending = this.messageQueue;
    this.messageQueue = [];
    for (const msg of pending) {
      this.send(msg);
    }
  }

  /** 真正发送 JSON 字符串 */
  private send(message: any): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // 兜底：万一状态不一致，重新入队
      this.messageQueue.push(message);
      return;
    }
    const messageStr = JSON.stringify(message);
    this.socket.send(messageStr);
  }

  public cast(message: any): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const messageStr = JSON.stringify(message);
    this.socket.send(messageStr);
  }

  /** 解析并分发服务端消息 */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      if (message.op === 'publish') {
        // 普通话题消息
        this.emit(message.topic, message.msg);
      } else if (message.op === 'service_response') {
        // 服务响应，用 id 匹配请求
        this.emit(message.id, message);
      } else if (message.op === 'status') {
        // 状态消息，可选带 id
        if (message.id) {
          this.emit('status:' + message.id, message);
        } else {
          this.emit('status', message);
        }
      } else if (message.op === 'service_request') {
        // 服务请求（作为服务端角色时）
        this.emit('service_request:' + message.service, message);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }
}
