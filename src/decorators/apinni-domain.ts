export interface DomainOptions {
    domains: Array<string>;
}

const ApinniDomain = (_options: DomainOptions) => {
    return function <T extends { new (...args: any[]): object }>(
        constructor: T
    ) {
        return constructor;
    };
};

export default ApinniDomain;
