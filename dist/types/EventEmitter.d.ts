export default class EventEmitter {
    private events;
    on(event: string, listener: Function): this;
    once(event: string, listener: Function): this;
    off(event: string, listener?: Function): this;
    emit(event: string, ...args: any[]): boolean;
    removeAllListeners(event?: string): this;
    listenerCount(event: string): number;
}
//# sourceMappingURL=EventEmitter.d.ts.map