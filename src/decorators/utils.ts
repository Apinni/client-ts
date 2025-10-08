type CountDuplicates<
    K extends string,
    Seen extends string[],
    Count extends number[] = [],
> = Seen extends [infer First extends string, ...infer Rest extends string[]]
    ? First extends K
        ? CountDuplicates<K, Rest, [...Count, any]>
        : CountDuplicates<K, Rest, Count>
    : Count;

type NormalizeParam<
    Param extends string,
    Seen extends string[],
> = CountDuplicates<Param, Seen>['length'] extends 0
    ? Param
    : `${NormalizeParam<
          `${Param}_${CountDuplicates<Param, Seen>['length']}`,
          Seen
      >}`;

export type NormalizePath<
    T extends string,
    Seen extends string[] = [],
    Output extends string = '',
> = T extends `${infer Before}:${infer Param}/${infer Rest}`
    ? NormalizePath<
          `/${Rest}`,
          [...Seen, Param],
          `${Output}${Before}:${NormalizeParam<Param, Seen>}`
      >
    : T extends `${infer Before}:${infer Param}`
      ? `${Output}${Before}:${NormalizeParam<Param, Seen>}`
      : `${Output}${T}`;
