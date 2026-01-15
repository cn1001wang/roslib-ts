import { default as EnhancedRos } from "./EnhancedRos";
type Callback = (msg: any) => void;
export declare class TopicManager {
    private topics;
    private ros;
    constructor(ros: EnhancedRos);
    /**
     * 订阅指定主题
     * @param name 主题名称
     * @param messageType 消息类型
     * @param callback 回调函数，当收到消息时调用
     */
    subscribe(name: string, messageType: string, callback: Callback): void;
    unsubscribe(name: string, callback?: Callback): void;
    clearAll(): void;
    resubscribeAll(ros: any): void;
    /**
     * 发布消息到指定主题
     * @param name 主题名称
     * @param messageType 消息类型
     * @param data 要发布的数据
     * @param queueWhenOffline 是否在 ROS 连接时队列消息（默认 false）
     * @returns Promise，成功时解析为 undefined，失败时拒绝
     */
    publish(name: string, messageType: string, data: any, queueWhenOffline?: boolean): Promise<unknown>;
}
export declare class ServiceManager {
    private ros;
    private readonly defaultTimeout;
    constructor(ros: EnhancedRos, timeout?: number);
    /**
     * 调用服务（每次直接创建 Service 实例，带统一超时）
     * @param name 服务名称
     * @param serviceType 服务类型
     * @param request 服务请求数据（可选）
     * @param timeout 超时时间（默认 10s）
     * @returns Promise，成功时解析为服务响应，失败时拒绝
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