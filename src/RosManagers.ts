import { default as EnhancedRos, EnhancedRosState } from './EnhancedRos';
import { default as Topic } from './Topic';
import { default as Service } from './Service';
import { default as ServiceRequest, ServiceResponse } from './ServiceRequest';
import { default as Param } from './Param';


type Callback = (msg: any) => void;

interface ManagedTopic {
  topic: Topic;
  messageType: string;
  callbacks: Set<Callback>;
}

export class TopicManager {
  private topics: Map<string, ManagedTopic> = new Map();
  private ros: EnhancedRos;

  constructor(ros: EnhancedRos) {
    this.ros = ros;
  }

  subscribe(name: string, messageType: string, callback: Callback) {    
    if(!this.ros){
      throw new Error('ros instance is not initialized')
    }
    if (!this.ros.isConnected) {
      console.warn(`ROS not connected, cannot subscribe to ${name}, ${name} in messageQueue when ros reconnected`);
    }

    // 已存在，添加回调即可
    if (this.topics.has(name)) {
      const managed = this.topics.get(name)!;
      managed.callbacks.add(callback);
      return;
    }

    // 创建新 topic
    const topic = new Topic({ ros: this.ros, name, messageType });
    const callbacks = new Set<Callback>();
    callbacks.add(callback);

    topic.subscribe((msg) => {
      callbacks.forEach((cb) => cb(msg));
    });

    this.topics.set(name, { topic, callbacks, messageType });
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
      const topic = new Topic({ ros, name, messageType: managed.messageType });
      managed.topic = topic;

      topic.subscribe((msg) => {
        managed.callbacks.forEach((cb) => cb(msg));
      });
    });
  }

  publish(name: string, messageType: string, data: any){
    if(!this.ros){
      throw new Error('ros instance is not initialized')
    }
    if (!this.ros.isConnected) {
      console.warn(`ROS not connected, cannot publish to ${name}, ${name} in messageQueue when ros reconnected`);
    }
    const chatter = new Topic({
      ros: this.ros,
      name,
      messageType 
    })
    chatter.publish({data:data})
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
   */
  call(
    name: string,
    serviceType: string,
    request?: any,
    timeout = this.defaultTimeout,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if(!this.ros){
        return reject(new Error('ros instance is not initialized'))
      }
      if (!this.ros.isConnected) {
        return reject(new Error(`ROS not connected, cannot call service ${name}`));
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
      const ros = this.ros

      if(!this.ros){
        return reject(new Error('ros instance is not initialized'))
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
      const ros = this.ros

      if(!this.ros){
        return reject(new Error('ros instance is not initialized'))
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
      const ros = this.ros
      if(!this.ros){
        return reject(new Error('ros instance is not initialized'))
      }
      if (!this.ros.isConnected) {
        return reject(new Error(`ROS not connected, cannot delete param ${name}`));
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

