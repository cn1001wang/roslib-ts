declare class EventEmitter {
    private events;
    on(event: string, listener: Function): this;
    once(event: string, listener: Function): this;
    off(event: string, listener?: Function): this;
    emit(event: string, ...args: any[]): boolean;
    removeAllListeners(event?: string): this;
    listenerCount(event: string): number;
}

interface RosOptions {
    url?: string;
    WebSocket?: typeof WebSocket;
}
interface RosLike {
    on(event: string, listener: Function): this;
    once(event: string, listener: Function): this;
    off(event: string, listener?: Function): this;
    emit(event: string, ...args: any[]): boolean;
    callOnConnection(message: any): void;
    getNextId(): string;
    readonly isConnected: boolean;
}
declare class Ros extends EventEmitter {
    private socket;
    private _isConnected;
    private idCounter;
    private options;
    constructor(options?: RosOptions);
    get isConnected(): boolean;
    connect(url: string): void;
    close(): void;
    private handleMessage;
    callOnConnection(message: any): void;
    getNextId(): string;
}

/**
 * 事件发射器，用于内部实现
 */

/**
 * 连接状态枚举
 */
declare enum EnhancedRosState {
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
interface EnhancedRosOptions {
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
declare class EnhancedRos extends EventEmitter implements RosLike {
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

interface TopicOptions {
    ros: RosLike;
    name: string;
    messageType: string;
    compression?: string;
    throttle_rate?: number;
    queue_size?: number;
    latch?: boolean;
    queue_length?: number;
}
declare class Topic extends EventEmitter {
    readonly ros: RosLike;
    readonly name: string;
    readonly messageType: string;
    readonly compression?: string;
    readonly throttle_rate?: number;
    readonly queue_size?: number;
    readonly latch?: boolean;
    readonly queue_length?: number;
    private isSubscribed;
    private isAdvertised;
    constructor(options: TopicOptions);
    subscribe(callback?: (message: any) => void): void;
    unsubscribe(): void;
    advertise(): void;
    unadvertise(): void;
    publish(message: any): void;
}

declare class ServiceRequest {
    [key: string]: any;
    constructor(values?: {
        [key: string]: any;
    });
}
declare class ServiceResponse {
    [key: string]: any;
    constructor(values?: {
        [key: string]: any;
    });
}

interface ServiceOptions {
    ros: RosLike;
    name: string;
    serviceType: string;
}
declare class Service extends EventEmitter {
    private ros;
    private name;
    private serviceType;
    private isAdvertised;
    constructor(options: ServiceOptions);
    callService(request: ServiceRequest, callback?: (response: ServiceResponse) => void, failedCallback?: (error: any) => void): Promise<ServiceResponse>;
    advertise(callback: (request: ServiceRequest, response: ServiceResponse) => boolean | void): void;
    unadvertise(): void;
}

interface ParamOptions {
    ros: RosLike;
    name: string;
}
declare class Param {
    private ros;
    private name;
    constructor(options: ParamOptions);
    get(callback?: (value: any) => void): Promise<any>;
    set(value: any, callback?: () => void): Promise<void>;
    delete(callback?: () => void): Promise<void>;
}

type Callback = (msg: any) => void;
declare class TopicManager {
    private topics;
    private ros;
    constructor(ros: EnhancedRos);
    subscribe(name: string, messageType: string, callback: Callback): void;
    unsubscribe(name: string, callback?: Callback): void;
    clearAll(): void;
    resubscribeAll(ros: any): void;
    public(name: string, messageType: string, data: any): void;
}
declare class ServiceManager {
    private ros;
    private readonly defaultTimeout;
    constructor(ros: EnhancedRos, timeout?: number);
    /**
     * 调用服务（每次直接创建 Service 实例，带统一超时）
     */
    call(name: string, serviceType: string, request?: any, timeout?: number): Promise<any>;
}
declare class ParamManager {
    private ros;
    private readonly defaultTimeout;
    constructor(ros: EnhancedRos, timeout?: number);
    /**
     * 获取参数值
     */
    get(name: string, timeout?: number): Promise<any>;
    /**
     * 设置参数值
     */
    set(name: string, value: any): Promise<void>;
    /**
     * 删除参数
     */
    delete(name: string): Promise<void>;
}

export { EnhancedRos, EnhancedRosState, EventEmitter, Param, ParamManager, Ros, Service, ServiceManager, ServiceRequest, ServiceResponse, Topic, TopicManager };
