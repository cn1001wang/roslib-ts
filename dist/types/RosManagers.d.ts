import { default as EnhancedRos } from './EnhancedRos';
type Callback = (msg: any) => void;
export declare class TopicManager {
    private topics;
    private ros;
    constructor(ros: EnhancedRos);
    subscribe(name: string, messageType: string, callback: Callback): void;
    unsubscribe(name: string, callback?: Callback): void;
    clearAll(): void;
    resubscribeAll(ros: any): void;
    public(name: string, messageType: string, data: any): void;
}
export declare class ServiceManager {
    private ros;
    private readonly defaultTimeout;
    constructor(ros: EnhancedRos, timeout?: number);
    /**
     * 调用服务（每次直接创建 Service 实例，带统一超时）
     */
    call(name: string, serviceType: string, request?: any, timeout?: number): Promise<any>;
}
export declare class ParamManager {
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
export {};
//# sourceMappingURL=RosManagers.d.ts.map