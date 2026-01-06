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
        this.reconnectTimer = null;
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
                // 清除重连定时器
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
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
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
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

export { EventEmitter, Param, Ros, Service, ServiceRequest, ServiceResponse, Topic };
//# sourceMappingURL=index.esm.js.map
