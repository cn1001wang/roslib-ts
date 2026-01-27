import { default as EnhancedRos } from "./EnhancedRos";
import { default as Topic } from "./Topic";
import { default as Service } from "./Service";
import { default as ServiceRequest } from "./ServiceRequest";
import { default as Param } from "./Param";
import { TopicOptions } from "./Topic";

type Callback = (msg: any) => void;
 type TopicConfigOptions = Omit<TopicOptions, 'ros' | 'name' | 'messageType'>;
interface ManagedTopic {
  topic: Topic;
  messageType: string;
  config?: TopicConfigOptions;
  callbacks: Set<Callback>;
}

export class TopicManager {
  private topics: Map<string, ManagedTopic> = new Map();
  private pubTopics: Map<string,  Omit<ManagedTopic, "callbacks">> = new Map();
  private ros: EnhancedRos;

  constructor(ros: EnhancedRos) {
    this.ros = ros;
  }
  /**
   * 订阅指定主题
   * @param name 主题名称
   * @param messageType 消息类型
   * @param callback 回调函数，当收到消息时调用
   * @param config 订阅配置选项（可选）
   */
  subscribe(name: string, messageType: string, callback: Callback, config?: TopicConfigOptions) {
    if (!this.ros) {
      throw new Error("ros instance is not initialized");
    }
    if (!this.ros.isConnected) {
      console.warn(
        `ROS not connected, cannot subscribe to ${name}, ${name} in messageQueue when ros reconnected`,
      );
    }

    // 已存在，添加回调即可
    if (this.topics.has(name)) {
      const managed = this.topics.get(name)!;
      managed.callbacks.add(callback);
      return;
    }

    // 创建新 topic
    const topic = new Topic({ ros: this.ros, name, messageType, ...config });
    const callbacks = new Set<Callback>();
    callbacks.add(callback);

    topic.subscribe((msg) => {
      callbacks.forEach((cb) => cb(msg));
    });

    this.topics.set(name, { topic, callbacks, messageType, config });
  }

  unsubscribe(name: string, callback?: Callback) {
    const managed = this.topics.get(name);
    if (!managed) return;

    if (callback) {
      managed.callbacks.delete(callback);
      // 如果没有回调了，取消订阅
      if (managed.callbacks.size === 0) {
        managed.topic.unsubscribe();
        this.topics.delete(name);
      }
    } else {
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

  resubscribeAll(ros: any) {
    this.topics.forEach((managed, name) => {
      const topic = new Topic({ ros, name, messageType: managed.messageType, ...managed.config });
      managed.topic = topic;

      topic.subscribe((msg) => {
        managed.callbacks.forEach((cb) => cb(msg));
      });
    });
  }
  /**
   * 发布消息到指定主题
   * @param name 主题名称
   * @param messageType 消息类型
   * @param data 要发布的数据
   * @param config 发布配置选项（可选）
   * @param queueWhenOffline 是否在 ROS 连接时队列消息（默认 false）
   * @returns Promise，成功时解析为 undefined，失败时拒绝
   */
  publish(
    name: string,
    messageType: string,
    data: any,
    config?: TopicConfigOptions,
    queueWhenOffline = false,
  ) {
    return new Promise((resolve, reject) => {
      if (!this.ros) {
        reject(new Error("ros instance is not initialized"));
        return;
      }
      if (!this.ros.isConnected) {
        if (!queueWhenOffline) {
          reject(new Error(`ROS not connected, cannot publish to ${name}`));
          return;
        }
        console.warn(
          `ROS not connected, cannot publish to ${name}, ${name} in messageQueue when ros reconnected`,
        );
      }
      // 已存在，添加回调即可
      if (this.pubTopics.has(name)) {
        const managed = this.pubTopics.get(name)!;
        managed.topic.publish(data);
        resolve(undefined);
        return;
      }
      const chatter = new Topic({
        ros: this.ros,
        name,
        messageType,
        ...config,
      });
      this.pubTopics.set(name, {
        topic: chatter,
        messageType,
      });
      chatter.publish(data);
      resolve(undefined);
    });
  }

  unadvertise(name: string) {
    const managed = this.pubTopics.get(name);
    if (!managed) return;
    managed.topic.unadvertise();
    this.pubTopics.delete(name);
  }

  unadvertiseAll() {
    this.pubTopics.forEach((managed) => {
      managed.topic.unadvertise();
    });
    this.pubTopics.clear();
  }
}
export class ServiceManager {
  private ros: EnhancedRos;
  private readonly defaultTimeout: number = 10000; // 默认超时 10s

  constructor(ros: EnhancedRos, timeout = 10000) {
    this.ros = ros;
    this.defaultTimeout = timeout;
  }

  /**
   * 调用服务（每次直接创建 Service 实例，带统一超时）
   * @param name 服务名称
   * @param serviceType 服务类型
   * @param request 服务请求数据（可选）
   * @param timeout 超时时间（默认 10s）
   * @returns Promise，成功时解析为服务响应，失败时拒绝
   */
  call(
    name: string,
    serviceType: string,
    request?: any,
    timeout = this.defaultTimeout,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ros) {
        return reject(new Error("ros instance is not initialized"));
      }
      if (!this.ros.isConnected) {
        return reject(
          new Error(`ROS not connected, cannot call service ${name}`),
        );
      }

      let timer: ReturnType<typeof setTimeout> | null = null;

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

        service.callService(
          serviceRequest,
          (result) => {
            cleanup();
            resolve(result);
          },
          (error) => {
            cleanup();
            reject(error);
          },
        );
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }
}

export class ParamManager {
  private ros: EnhancedRos;
  private readonly defaultTimeout: number = 10000; // 默认超时 10s

  constructor(ros: EnhancedRos, timeout = 10000) {
    this.ros = ros;
    this.defaultTimeout = timeout;
  }
  /**
   * 获取参数值
   */
  get(name: string, timeout: number = this.defaultTimeout): Promise<any> {
    return new Promise((resolve, reject) => {
      const ros = this.ros;

      if (!this.ros) {
        return reject(new Error("ros instance is not initialized"));
      }
      if (!this.ros.isConnected) {
        return reject(new Error(`ROS not connected, cannot get param ${name}`));
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
  set(name: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const ros = this.ros;

      if (!this.ros) {
        return reject(new Error("ros instance is not initialized"));
      }
      if (!this.ros.isConnected) {
        return reject(new Error(`ROS not connected, cannot set param ${name}`));
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
  delete(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ros = this.ros;
      if (!this.ros) {
        return reject(new Error("ros instance is not initialized"));
      }
      if (!this.ros.isConnected) {
        return reject(
          new Error(`ROS not connected, cannot delete param ${name}`),
        );
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
