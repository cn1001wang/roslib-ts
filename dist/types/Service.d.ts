import EventEmitter from './EventEmitter';
import { RosLike } from './Ros';
import ServiceRequest, { ServiceResponse } from './ServiceRequest';
interface ServiceOptions {
    ros: RosLike;
    name: string;
    serviceType: string;
}
export default class Service extends EventEmitter {
    private ros;
    private name;
    private serviceType;
    private isAdvertised;
    constructor(options: ServiceOptions);
    callService(request: ServiceRequest, callback?: (response: ServiceResponse) => void, failedCallback?: (error: any) => void): Promise<ServiceResponse>;
    advertise(callback: (request: ServiceRequest, response: ServiceResponse) => boolean | void): void;
    unadvertise(): void;
}
export {};
//# sourceMappingURL=Service.d.ts.map