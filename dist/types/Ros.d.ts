import EventEmitter from './EventEmitter';
interface RosOptions {
    url?: string;
    WebSocket?: typeof WebSocket;
}
export interface RosLike {
    on(event: string, listener: Function): this;
    once(event: string, listener: Function): this;
    off(event: string, listener?: Function): this;
    emit(event: string, ...args: any[]): boolean;
    callOnConnection(message: any): void;
    getNextId(): string;
    readonly isConnected: boolean;
}
export default class Ros extends EventEmitter {
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
export {};
//# sourceMappingURL=Ros.d.ts.map