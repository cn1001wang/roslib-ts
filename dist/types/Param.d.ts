import { RosLike } from './Ros';
interface ParamOptions {
    ros: RosLike;
    name: string;
}
export default class Param {
    private ros;
    private name;
    constructor(options: ParamOptions);
    get(callback?: (value: any) => void): Promise<any>;
    set(value: any, callback?: () => void): Promise<void>;
    delete(callback?: () => void): Promise<void>;
}
export {};
//# sourceMappingURL=Param.d.ts.map