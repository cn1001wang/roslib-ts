import EventEmitter from './EventEmitter';
interface RosOptions {
    url?: string;
    WebSocket?: typeof WebSocket;
}
export default class Ros extends EventEmitter {
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
export {};
//# sourceMappingURL=Ros.d.ts.map