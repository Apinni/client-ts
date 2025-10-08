export type DisabledOptions =
    | { disabled: boolean; reason?: string }
    | {
          domains: Partial<{ '*': boolean; [domain: string]: boolean }>;
          reason?: string;
      };

const ApinniDisabled = (_options?: DisabledOptions) => {
    return function (
        target: any,
        propertyKey?: string,
        descriptor?: PropertyDescriptor
    ) {
        if (propertyKey && descriptor) {
            return descriptor;
        } else {
            return target;
        }
    };
};

export default ApinniDisabled;
