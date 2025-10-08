import { Dependency, ApinniPlugin, OverridedContext } from '@interfaces';

export type Hooks = Exclude<
    keyof ApinniPlugin<OverridedContext, [Dependency], true>['hooks'],
    'onProvideSharedContext'
>;

type NotOptional<T> = [T] extends [infer R | undefined] ? R : T;

export type HooksParams = {
    [K in Hooks]: K extends 'onConsumeDependencyContexts'
        ? []
        : NotOptional<
                ApinniPlugin<OverridedContext, [Dependency], true>['hooks'][K]
            > extends (...args: infer R) => any
          ? R extends []
              ? []
              : R
          : [];
};
