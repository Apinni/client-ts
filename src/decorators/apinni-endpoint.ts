import { NormalizePath } from './utils';

type OptionDefinition = {
    model: string;
    name?: string;
};

export interface EndpointOptions<T extends string = string> {
    path: NormalizePath<T>;
    method: string;
    query?: OptionDefinition | Array<string>;
    request?: OptionDefinition;
    responses?:
        | OptionDefinition
        | {
              [status: number]: OptionDefinition;
          };
}

type TypeDefinition = {
    type: unknown;
    name?: string;
};

type ResponseType =
    | TypeDefinition
    | {
          [status: number]: TypeDefinition;
      };
interface TypeShape {
    query?: TypeDefinition;
    request?: TypeDefinition;
    responses?: ResponseType;
}

export type EndpointShape<T extends TypeShape = TypeShape> = T;

type ApinniEndpointDecorator = <
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Shape extends TypeShape = TypeShape,
    Path extends string = string,
>(
    options: EndpointOptions<Path>
) => (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
) => PropertyDescriptor;

const ApinniEndpoint: ApinniEndpointDecorator = _options => {
    return function (_: any, __: string, descriptor: PropertyDescriptor) {
        return descriptor;
    };
};

export default ApinniEndpoint;
