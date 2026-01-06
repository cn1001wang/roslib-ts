// 简单的事件发射器实现
class EventEmitter {
    constructor() {
        this.events = {};
    }
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return this;
    }
    once(event, listener) {
        const onceWrapper = (...args) => {
            this.off(event, onceWrapper);
            listener.apply(this, args);
        };
        this.on(event, onceWrapper);
        return this;
    }
    off(event, listener) {
        if (!this.events[event])
            return this;
        if (!listener) {
            delete this.events[event];
            return this;
        }
        const index = this.events[event].indexOf(listener);
        if (index > -1) {
            this.events[event].splice(index, 1);
        }
        return this;
    }
    emit(event, ...args) {
        if (!this.events[event])
            return false;
        this.events[event].forEach(listener => {
            try {
                listener.apply(this, args);
            }
            catch (error) {
                console.error('Error in event listener:', error);
            }
        });
        return true;
    }
    removeAllListeners(event) {
        if (event) {
            delete this.events[event];
        }
        else {
            this.events = {};
        }
        return this;
    }
    listenerCount(event) {
        return this.events[event] ? this.events[event].length : 0;
    }
}

class Ros extends EventEmitter {
    // private reconnectDelay = 1000;
    constructor(options = {}) {
        super();
        this.socket = null;
        this._isConnected = false;
        this.idCounter = 0;
        this.options = options;
        if (options.url) {
            this.connect(options.url);
        }
    }
    get isConnected() {
        return this._isConnected;
    }
    connect(url) {
        var _a, _b;
        if (this.socket && this.socket.readyState === WebSocket.OPEN && this.socket.url === url) {
            return;
        }
        if (this.socket) {
            this.close();
        }
        try {
            const WS = (_b = (_a = this.options) === null || _a === void 0 ? void 0 : _a.WebSocket) !== null && _b !== void 0 ? _b : WebSocket;
            this.socket = new WS(url);
            this.socket.onopen = () => {
                this._isConnected = true;
                this.emit('connection');
            };
            this.socket.onclose = () => {
                this._isConnected = false;
                this.emit('close');
            };
            this.socket.onerror = (error) => {
                this.emit('error', error);
            };
            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };
        }
        catch (error) {
            this.emit('error', error);
        }
    }
    close() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this._isConnected = false;
    }
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            if (message.op === 'publish') {
                // 发布消息到对应的 topic
                this.emit(message.topic, message.msg);
            }
            else if (message.op === 'service_response') {
                // 服务响应
                this.emit(message.id, message);
            }
            else if (message.op === 'status') {
                // 状态消息
                if (message.id) {
                    this.emit('status:' + message.id, message);
                }
                else {
                    this.emit('status', message);
                }
            }
        }
        catch (error) {
            console.error('Error parsing message:', error);
        }
    }
    callOnConnection(message) {
        const messageStr = JSON.stringify(message);
        if (this._isConnected && this.socket) {
            this.socket.send(messageStr);
        }
        else {
            // 等待连接建立后发送
            this.once('connection', () => {
                if (this.socket) {
                    this.socket.send(messageStr);
                }
            });
        }
    }
    getNextId() {
        return (++this.idCounter).toString();
    }
}

/**
 * 事件发射器，用于内部实现
 */
/**
 * 连接状态枚举
 */
var EnhancedRosState;
(function (EnhancedRosState) {
    /** 空闲/初始状态 */
    EnhancedRosState["IDLE"] = "IDLE";
    /** 正在连接 */
    EnhancedRosState["CONNECTING"] = "CONNECTING";
    /** 已连接 */
    EnhancedRosState["CONNECTED"] = "CONNECTED";
    /** 正在重连 */
    EnhancedRosState["RECONNECTING"] = "RECONNECTING";
    /** 已手动关闭 */
    EnhancedRosState["CLOSED"] = "CLOSED";
    /** 发生错误 */
    EnhancedRosState["ERROR"] = "ERROR";
})(EnhancedRosState || (EnhancedRosState = {}));
/**
 * 增强版 ROS 连接封装
 * 支持自动重连、心跳保活、消息队列、状态管理
 */
class EnhancedRos extends EventEmitter {
    /**
     * 构造函数
     * @param options 配置项
     */
    constructor(options = {}) {
        var _a, _b, _c;
        super();
        /** WebSocket 实例 */
        this.socket = null;
        /** 自增 ID 计数器，用于请求-响应匹配 */
        this.idCounter = 0;
        /** 当前连接状态 */
        this._state = EnhancedRosState.IDLE;
        /** 当前/最近一次连接地址 */
        this.currentUrl = null;
        /** 离线消息队列，连接成功后自动发送 */
        this.messageQueue = [];
        /** 重连定时器句柄 */
        this.reconnectTimer = null;
        /** 心跳定时器句柄 */
        this.heartbeatTimer = null;
        /** 最近一次收到服务端消息的时间戳 */
        this.lastServerMessageAtMs = null;
        /** 标记是否为用户主动关闭（影响重连策略） */
        this.manualClose = false;
        /** 连接代际，用于丢弃过期的重连任务 */
        this.connectGeneration = 0;
        this.options = options;
        // 初始化重连退避参数
        this.reconnectMinDelayMs = (_a = options.reconnect_min_delay) !== null && _a !== void 0 ? _a : 1000;
        this.reconnectMaxDelayMs = (_b = options.reconnect_max_delay) !== null && _b !== void 0 ? _b : 30000;
        this.reconnectDelayMs = this.reconnectMinDelayMs;
        // 初始化心跳参数 开启的话12000ms，不开启0ms
        this.heartbeatIntervalMs = (_c = options.heartbeat_interval_ms) !== null && _c !== void 0 ? _c : 0;
        this.heartbeatFn = options.heartbeat_fn;
        // 如果提供了 url，立即开始连接
        if (options.url) {
            this.connect(options.url);
        }
    }
    /** 获取当前状态 */
    get state() {
        return this._state;
    }
    /** 是否已连接 */
    get isConnected() {
        return this._state === EnhancedRosState.CONNECTED;
    }
    /**
     * 建立连接（如已连接相同地址则忽略）
     * @param url WebSocket 地址，例如 ws://localhost:9090
     */
    connect(url) {
        // 避免重复连接相同地址
        if (this.currentUrl === url &&
            (this._state === EnhancedRosState.CONNECTING || this._state === EnhancedRosState.CONNECTED)) {
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
    close() {
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
    callOnConnection(message) {
        if (this._state !== EnhancedRosState.CONNECTED || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.messageQueue.push(message);
            return;
        }
        this.send(message);
    }
    /**
     * 获取下一个自增 ID（字符串形式）
     */
    getNextId() {
        return (++this.idCounter).toString();
    }
    /* ===================== 私有方法 ===================== */
    /** 状态变更并对外广播 */
    setState(next) {
        if (this._state === next)
            return;
        this._state = next;
        this.emit('state', next);
    }
    /** 连接前清理资源 */
    cleanupForConnect() {
        this.clearReconnectTimer();
        this.stopHeartbeat();
        this.closeSocket();
        this.messageQueue = [];
        this.reconnectDelayMs = this.reconnectMinDelayMs;
        this.lastServerMessageAtMs = null;
    }
    /** 清除重连定时器 */
    clearReconnectTimer() {
        if (!this.reconnectTimer)
            return;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
    }
    /** 创建并绑定 WebSocket 事件 */
    openSocket(url) {
        var _a, _b;
        try {
            const WS = (_b = (_a = this.options) === null || _a === void 0 ? void 0 : _a.WebSocket) !== null && _b !== void 0 ? _b : WebSocket;
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
        }
        catch (error) {
            this.emit('error', error);
            this.setState(EnhancedRosState.ERROR);
        }
    }
    /** 安全关闭 WebSocket */
    closeSocket() {
        if (!this.socket)
            return;
        try {
            this.socket.close();
        }
        finally {
            this.socket = null;
        }
    }
    /** 调度下一次重连（退避策略，达到最大后固定） */
    scheduleReconnect() {
        if (!this.currentUrl) {
            this.setState(EnhancedRosState.ERROR);
            return;
        }
        const generation = this.connectGeneration;
        const delayMs = this.reconnectDelayMs;
        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
            if (this.manualClose)
                return;
            if (generation !== this.connectGeneration)
                return; // 连接已过期
            if (this._state !== EnhancedRosState.RECONNECTING)
                return;
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
    startHeartbeat() {
        this.stopHeartbeat();
        if (this.heartbeatIntervalMs <= 0)
            return;
        this.heartbeatTimer = setInterval(() => {
            if (this._state !== EnhancedRosState.CONNECTED)
                return;
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN)
                return;
            const now = Date.now();
            const last = this.lastServerMessageAtMs;
            // 超过两倍心跳间隔未收到消息，认为连接失效
            if (last && now - last > this.heartbeatIntervalMs * 2) {
                this.setState(EnhancedRosState.RECONNECTING);
                try {
                    this.socket.close();
                }
                catch (_a) { }
                if (!this.reconnectTimer) {
                    this.scheduleReconnect();
                }
                return;
            }
            // 发送 ping 保活
            if (this.heartbeatFn) {
                this.heartbeatFn();
            }
            else {
                /// 默认心跳：调用 /rosapi/get_time 服务
                this.cast({ op: "call_service", id: this.getNextId(), service: "/rosapi/get_time", type: "rosapi/GetTime", args: {} });
            }
        }, this.heartbeatIntervalMs);
    }
    /** 停止心跳定时器 */
    stopHeartbeat() {
        if (!this.heartbeatTimer)
            return;
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
    }
    /** 将离线队列全部发出 */
    flushQueue() {
        if (this._state !== EnhancedRosState.CONNECTED || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        if (this.messageQueue.length === 0)
            return;
        const pending = this.messageQueue;
        this.messageQueue = [];
        for (const msg of pending) {
            this.send(msg);
        }
    }
    /** 真正发送 JSON 字符串 */
    send(message) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            // 兜底：万一状态不一致，重新入队
            this.messageQueue.push(message);
            return;
        }
        const messageStr = JSON.stringify(message);
        this.socket.send(messageStr);
    }
    cast(message) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        const messageStr = JSON.stringify(message);
        this.socket.send(messageStr);
    }
    /** 解析并分发服务端消息 */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            if (message.op === 'publish') {
                // 普通话题消息
                this.emit(message.topic, message.msg);
            }
            else if (message.op === 'service_response') {
                // 服务响应，用 id 匹配请求
                this.emit(message.id, message);
            }
            else if (message.op === 'status') {
                // 状态消息，可选带 id
                if (message.id) {
                    this.emit('status:' + message.id, message);
                }
                else {
                    this.emit('status', message);
                }
            }
            else if (message.op === 'service_request') {
                // 服务请求（作为服务端角色时）
                this.emit('service_request:' + message.service, message);
            }
        }
        catch (error) {
            console.error('Error parsing message:', error);
        }
    }
}

class Topic extends EventEmitter {
    constructor(options) {
        super();
        this.isSubscribed = false;
        this.isAdvertised = false;
        this.ros = options.ros;
        this.name = options.name;
        this.messageType = options.messageType;
        this.compression = options.compression;
        this.throttle_rate = options.throttle_rate;
        this.queue_size = options.queue_size;
        this.latch = options.latch;
        this.queue_length = options.queue_length;
    }
    subscribe(callback) {
        if (this.isSubscribed) {
            return;
        }
        const subscribeMessage = Object.assign(Object.assign(Object.assign({ op: 'subscribe', topic: this.name, type: this.messageType }, (this.compression && { compression: this.compression })), (this.throttle_rate && { throttle_rate: this.throttle_rate })), (this.queue_length && { queue_length: this.queue_length }));
        this.ros.callOnConnection(subscribeMessage);
        this.isSubscribed = true;
        // 监听来自 ROS 的消息
        this.ros.on(this.name, (message) => {
            this.emit('message', message);
            if (callback) {
                callback(message);
            }
        });
        // 监听连接关闭事件，重新订阅
        this.ros.on('close', () => {
            this.isSubscribed = false;
        });
        this.ros.on('connection', () => {
            if (!this.isSubscribed) {
                this.subscribe(callback);
            }
        });
    }
    unsubscribe() {
        if (!this.isSubscribed) {
            return;
        }
        const unsubscribeMessage = {
            op: 'unsubscribe',
            topic: this.name
        };
        this.ros.callOnConnection(unsubscribeMessage);
        this.isSubscribed = false;
        // 移除事件监听器
        this.ros.off(this.name);
    }
    advertise() {
        if (this.isAdvertised) {
            return;
        }
        const advertiseMessage = Object.assign(Object.assign({ op: 'advertise', topic: this.name, type: this.messageType }, (this.latch && { latch: this.latch })), (this.queue_size && { queue_size: this.queue_size }));
        this.ros.callOnConnection(advertiseMessage);
        this.isAdvertised = true;
        // 监听连接关闭事件
        this.ros.on('close', () => {
            this.isAdvertised = false;
        });
        this.ros.on('connection', () => {
            if (!this.isAdvertised) {
                this.advertise();
            }
        });
    }
    unadvertise() {
        if (!this.isAdvertised) {
            return;
        }
        const unadvertiseMessage = {
            op: 'unadvertise',
            topic: this.name
        };
        this.ros.callOnConnection(unadvertiseMessage);
        this.isAdvertised = false;
    }
    publish(message) {
        if (!this.isAdvertised) {
            this.advertise();
        }
        const publishMessage = {
            op: 'publish',
            topic: this.name,
            msg: message
        };
        this.ros.callOnConnection(publishMessage);
    }
}

class ServiceRequest {
    constructor(values) {
        if (values) {
            Object.assign(this, values);
        }
    }
}
class ServiceResponse {
    constructor(values) {
        if (values) {
            Object.assign(this, values);
        }
    }
}

class Service extends EventEmitter {
    constructor(options) {
        super();
        this.isAdvertised = false;
        this.ros = options.ros;
        this.name = options.name;
        this.serviceType = options.serviceType;
    }
    callService(request, callback, failedCallback) {
        return new Promise((resolve, reject) => {
            const serviceId = this.ros.getNextId();
            const serviceMessage = {
                op: 'call_service',
                id: serviceId,
                service: this.name,
                type: this.serviceType,
                args: request
            };
            // 监听服务响应
            const responseHandler = (message) => {
                var _a;
                if (message.id === serviceId) {
                    this.ros.off(serviceId, responseHandler);
                    // rosbridge-level error
                    if (message.result === false) {
                        const error = new Error(message.error || `Service ${this.name} call failed`);
                        failedCallback === null || failedCallback === void 0 ? void 0 : failedCallback(error);
                        reject(error);
                        return;
                    }
                    // protocol error
                    if (message.result === undefined) {
                        const error = new Error('Invalid service response');
                        failedCallback === null || failedCallback === void 0 ? void 0 : failedCallback(error);
                        reject(error);
                        return;
                    }
                    // success
                    const response = new ServiceResponse((_a = message.values) !== null && _a !== void 0 ? _a : {});
                    callback === null || callback === void 0 ? void 0 : callback(response);
                    resolve(response);
                }
            };
            this.ros.on(serviceId, responseHandler);
            this.ros.callOnConnection(serviceMessage);
        });
    }
    advertise(callback) {
        if (this.isAdvertised) {
            return;
        }
        const advertiseMessage = {
            op: 'advertise_service',
            service: this.name,
            type: this.serviceType
        };
        this.ros.callOnConnection(advertiseMessage);
        this.isAdvertised = true;
        // 监听服务请求
        this.ros.on('service_request:' + this.name, (message) => {
            const request = new ServiceRequest(message.args);
            const response = new ServiceResponse();
            try {
                const result = callback(request, response);
                const responseMessage = {
                    op: 'service_response',
                    service: this.name,
                    id: message.id,
                    values: response,
                    result: result !== false
                };
                this.ros.callOnConnection(responseMessage);
            }
            catch (error) {
                const errorMessage = {
                    op: 'service_response',
                    service: this.name,
                    id: message.id,
                    result: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
                this.ros.callOnConnection(errorMessage);
            }
        });
        // 监听连接关闭事件
        this.ros.on('close', () => {
            this.isAdvertised = false;
        });
        this.ros.on('connection', () => {
            if (!this.isAdvertised) {
                this.advertise(callback);
            }
        });
    }
    unadvertise() {
        if (!this.isAdvertised) {
            return;
        }
        const unadvertiseMessage = {
            op: 'unadvertise_service',
            service: this.name
        };
        this.ros.callOnConnection(unadvertiseMessage);
        this.isAdvertised = false;
        // 移除事件监听器
        this.ros.off('service_request:' + this.name);
    }
}

class Param {
    constructor(options) {
        this.ros = options.ros;
        this.name = options.name;
    }
    get(callback) {
        return new Promise((resolve, reject) => {
            const service = new Service({
                ros: this.ros,
                name: '/rosapi/get_param',
                serviceType: 'rosapi/GetParam'
            });
            const request = new ServiceRequest({
                name: this.name,
                default: ''
            });
            service.callService(request, (response) => {
                if (callback)
                    callback(response.value);
                resolve(response.value);
            }, (error) => {
                reject(error);
            });
        });
    }
    set(value, callback) {
        return new Promise((resolve, reject) => {
            const service = new Service({
                ros: this.ros,
                name: '/rosapi/set_param',
                serviceType: 'rosapi/SetParam'
            });
            const request = new ServiceRequest({
                name: this.name,
                value: JSON.stringify(value)
            });
            service.callService(request, () => {
                if (callback)
                    callback();
                resolve();
            }, (error) => {
                reject(error);
            });
        });
    }
    delete(callback) {
        return new Promise((resolve, reject) => {
            const service = new Service({
                ros: this.ros,
                name: '/rosapi/delete_param',
                serviceType: 'rosapi/DeleteParam'
            });
            const request = new ServiceRequest({
                name: this.name
            });
            service.callService(request, () => {
                if (callback)
                    callback();
                resolve();
            }, (error) => {
                reject(error);
            });
        });
    }
}

class TopicManager {
    constructor(ros) {
        this.topics = new Map();
        this.ros = ros;
    }
    subscribe(name, messageType, callback) {
        if (!this.ros) {
            throw new Error('ros instance is not initialized');
        }
        if (!this.ros.isConnected) {
            console.warn(`ROS not connected, cannot subscribe to ${name}, ${name} in messageQueue when ros reconnected`);
        }
        // 已存在，添加回调即可
        if (this.topics.has(name)) {
            const managed = this.topics.get(name);
            managed.callbacks.add(callback);
            return;
        }
        // 创建新 topic
        const topic = new Topic({ ros: this.ros, name, messageType });
        const callbacks = new Set();
        callbacks.add(callback);
        topic.subscribe((msg) => {
            callbacks.forEach((cb) => cb(msg));
        });
        this.topics.set(name, { topic, callbacks, messageType });
    }
    unsubscribe(name, callback) {
        const managed = this.topics.get(name);
        if (!managed)
            return;
        if (callback) {
            managed.callbacks.delete(callback);
            // 如果没有回调了，取消订阅
            if (managed.callbacks.size === 0) {
                managed.topic.unsubscribe();
                this.topics.delete(name);
            }
        }
        else {
            // 取消所有订阅
            managed.topic.unsubscribe();
            this.topics.delete(name);
        }
    }
    clearAll() {
        this.topics.forEach((managed) => {
            managed.topic.unsubscribe();
        });
        this.topics.clear();
    }
    resubscribeAll(ros) {
        this.topics.forEach((managed, name) => {
            const topic = new Topic({ ros, name, messageType: managed.messageType });
            managed.topic = topic;
            topic.subscribe((msg) => {
                managed.callbacks.forEach((cb) => cb(msg));
            });
        });
    }
    public(name, messageType, data) {
        const chatter = new Topic({
            ros: this.ros,
            name,
            messageType
        });
        chatter.publish({ data: data });
    }
}
class ServiceManager {
    constructor(ros, timeout = 10000) {
        this.defaultTimeout = 10000; // 默认超时 10s
        this.ros = ros;
        this.defaultTimeout = timeout;
    }
    /**
     * 调用服务（每次直接创建 Service 实例，带统一超时）
     */
    call(name, serviceType, request, timeout = this.defaultTimeout) {
        return new Promise((resolve, reject) => {
            if (!this.ros) {
                throw new Error('ros instance is not initialized');
            }
            if (!this.ros.isConnected) {
                console.warn(`ROS not connected, cannot subscribe to ${name}, ${name} in messageQueue when ros reconnected`);
            }
            let timer = null;
            const cleanup = () => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            };
            timer = setTimeout(() => {
                cleanup();
                reject(new Error(`Service call ${name} timeout after ${timeout}ms`));
            }, timeout);
            try {
                const service = new Service({
                    ros: this.ros,
                    name,
                    serviceType,
                });
                const serviceRequest = new ServiceRequest(request);
                service.callService(serviceRequest, (result) => {
                    cleanup();
                    resolve(result);
                }, (error) => {
                    cleanup();
                    reject(error);
                });
            }
            catch (error) {
                cleanup();
                reject(error);
            }
        });
    }
}
class ParamManager {
    constructor(ros, timeout = 10000) {
        this.defaultTimeout = 10000; // 默认超时 10s
        this.ros = ros;
        this.defaultTimeout = timeout;
    }
    /**
     * 获取参数值
     */
    get(name, timeout = this.defaultTimeout) {
        return new Promise((resolve, reject) => {
            const ros = this.ros;
            if (!ros) {
                throw new Error('ros instance is not initialized');
            }
            if (!ros.isConnected) {
                console.warn(`ROS not connected, cannot get to ${name}, ${name} in messageQueue when ros reconnected`);
            }
            const param = new Param({ ros, name });
            const timer = setTimeout(() => {
                reject(new Error(`Get param ${name} timeout`));
            }, timeout);
            param
                .get((value) => {
                clearTimeout(timer);
                resolve(value);
            })
                .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    /**
     * 设置参数值
     */
    set(name, value) {
        return new Promise((resolve, reject) => {
            const ros = this.ros;
            if (!ros) {
                throw new Error('ros instance is not initialized');
            }
            if (!ros.isConnected) {
                console.warn(`ROS not connected, cannot set to ${name}, ${name} in messageQueue when ros reconnected`);
            }
            const param = new Param({ ros, name });
            param
                .set(value, () => {
                resolve();
            })
                .catch((error) => {
                reject(error);
            });
        });
    }
    /**
     * 删除参数
     */
    delete(name) {
        return new Promise((resolve, reject) => {
            const ros = this.ros;
            if (!ros) {
                throw new Error('ros instance is not initialized');
            }
            if (!ros.isConnected) {
                console.warn(`ROS not connected, cannot delete to ${name}, ${name} in messageQueue when ros reconnected`);
            }
            const param = new Param({ ros, name });
            param
                .delete(() => {
                resolve();
            })
                .catch((error) => {
                reject(error);
            });
        });
    }
}

export { EnhancedRos, EnhancedRosState, EventEmitter, Param, ParamManager, Ros, Service, ServiceManager, ServiceRequest, ServiceResponse, Topic, TopicManager };
//# sourceMappingURL=index.esm.js.map
