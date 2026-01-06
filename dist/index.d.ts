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
declare class Ros extends EventEmitter {
    private socket;
    private _isConnected;
    private idCounter;
    private reconnectTimer;
    private options;
    constructor(options?: RosOptions);
    get isConnected(): boolean;
    connect(url: string): void;
    close(): void;
    private handleMessage;
    callOnConnection(message: any): void;
    getNextId(): string;
}

interface TopicOptions {
    ros: Ros;
    name: string;
    messageType: string;
    compression?: string;
    throttle_rate?: number;
    queue_size?: number;
    latch?: boolean;
    queue_length?: number;
}
declare class Topic extends EventEmitter {
    readonly ros: Ros;
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
    ros: Ros;
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
    ros: Ros;
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

export { EventEmitter, Param, Ros, Service, ServiceRequest, ServiceResponse, Topic };
