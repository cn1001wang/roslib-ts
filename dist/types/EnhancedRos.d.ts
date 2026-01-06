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
export declare enum EnhancedRosState {
    /** 空闲/初始状态 */
    IDLE = "IDLE",
    /** 正在连接 */
    CONNECTING = "CONNECTING",
    /** 已连接 */
    CONNECTED = "CONNECTED",
    /** 正在重连 */
    RECONNECTING = "RECONNECTING",
    /** 已手动关闭 */
    CLOSED = "CLOSED",
    /** 发生错误 */
    ERROR = "ERROR"
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
    private socket;
    /** 自增 ID 计数器，用于请求-响应匹配 */
    private idCounter;
    /** 用户配置副本 */
    private options;
    /** 当前连接状态 */
    private _state;
    /** 当前/最近一次连接地址 */
    private currentUrl;
    /** 离线消息队列，连接成功后自动发送 */
    private messageQueue;
    /** 重连定时器句柄 */
    private reconnectTimer;
    /** 本次重连等待时长（动态退避） */
    private reconnectDelayMs;
    /** 最小重连延迟（配置值,默认1s） */
    private readonly reconnectMinDelayMs;
    /** 最大重连延迟（配置值,默认30s） */
    private readonly reconnectMaxDelayMs;
    /** 心跳定时器句柄 */
    private heartbeatTimer;
    /** 心跳间隔（配置值,默认0s不启用） */
    private readonly heartbeatIntervalMs;
    /** 心跳函数（默认发送 ping 消息） */
    private readonly heartbeatFn?;
    /** 最近一次收到服务端消息的时间戳 */
    private lastServerMessageAtMs;
    /** 标记是否为用户主动关闭（影响重连策略） */
    private manualClose;
    /** 连接代际，用于丢弃过期的重连任务 */
    private connectGeneration;
    /**
     * 构造函数
     * @param options 配置项
     */
    constructor(options?: EnhancedRosOptions);
    /** 获取当前状态 */
    get state(): EnhancedRosState;
    /** 是否已连接 */
    get isConnected(): boolean;
    /**
     * 建立连接（如已连接相同地址则忽略）
     * @param url WebSocket 地址，例如 ws://localhost:9090
     */
    connect(url: string): void;
    /**
     * 手动关闭连接（不会触发自动重连）
     */
    close(): void;
    /**
     * 发送消息（离线时自动入队）
     * @param message 任意 JSON 兼容对象
     */
    callOnConnection(message: any): void;
    /**
     * 获取下一个自增 ID（字符串形式）
     */
    getNextId(): string;
    /** 状态变更并对外广播 */
    private setState;
    /** 连接前清理资源 */
    private cleanupForConnect;
    /** 清除重连定时器 */
    private clearReconnectTimer;
    /** 创建并绑定 WebSocket 事件 */
    private openSocket;
    /** 安全关闭 WebSocket */
    private closeSocket;
    /** 调度下一次重连（退避策略，达到最大后固定） */
    private scheduleReconnect;
    /** 启动心跳定时器 */
    private startHeartbeat;
    /** 停止心跳定时器 */
    private stopHeartbeat;
    /** 将离线队列全部发出 */
    private flushQueue;
    /** 真正发送 JSON 字符串 */
    private send;
    cast(message: any): void;
    /** 解析并分发服务端消息 */
    private handleMessage;
}
//# sourceMappingURL=EnhancedRos.d.ts.map