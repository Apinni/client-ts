import { NormalizePath } from './utils';

export interface ControllerOptions<T extends string = string> {
    path: NormalizePath<T>;
}

const ApinniController = <Path extends string = string>(
    _options: ControllerOptions<Path>
) => {
    return function <T extends { new (...args: any[]): object }>(
        constructor: T
    ) {
        return constructor;
    };
};

export default ApinniController;
