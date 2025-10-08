import { ClassMetadata, MethodMetadata } from './context';
import { ShareableContext, ShareableRegistry } from './shared';

export interface SharedContext<T = any> {
    /** Plugin-specific shared context data */
    data: T;
}

export interface DependencyOptions {
    allowContextManipulation?: boolean;
}

export interface Dependency {
    plugin: ShareablePlugin;
    options?: DependencyOptions;
}

export interface OverridedContext<
    T extends Record<string, any> = Record<string, any>,
    U extends Record<string, any> = Record<string, any>,
> {
    classMetadata: T;
    methodMetadata: U;
}

type ExtractDependenciesOverridedContext<
    Dependencies extends Dependency[] = [],
> = Dependencies extends [Dependency, ...Dependency[]]
    ? {
          [K in keyof Dependencies]: Dependencies[K]['options'] extends DependencyOptions
              ? Dependencies[K]['options']['allowContextManipulation'] extends true
                  ? ExtractOverridedContext<Dependencies[K]['plugin']>
                  : OverridedContext
              : OverridedContext;
      }[number]
    : OverridedContext;

/**
 * Base configuration and hooks for a Apinni plugin
 */
export interface BaseApinniPluginProps<
    OverridedGlobalContext extends OverridedContext = OverridedContext,
    Dependencies extends Dependency[] = [],
    IsShareable extends boolean = false,
    SharedContextData extends [IsShareable] extends [true] ? any : never = [
        IsShareable,
    ] extends [true]
        ? any
        : never,
> {
    /** Unique identifier for the plugin */
    name: string;

    /** Plugin configuration options */
    config?: {
        /**
         * Set to `true` if this plugin should be available as a dependency
         * for other plugins. Only shareable plugins can be used as dependencies.
         *
         * **Note:**
         *
         * If plugin is used as dependency - the manipulation with global context
         * could be restricted. By default the follow methods will be skipped:
         * 1. `onRegisterMetadata()`
         * 2. `onGenerateTypes()`
         *
         * Only if consumer pass the option **allowContextManipulation** as `true`
         * all the hooks will be executed.
         */
        shareable?: IsShareable;
    };

    /**
     * Plugin lifecycle hooks executed in the following order:
     * 1. `onInitialize()` - Initialize decorators in registry
     * 2. `onAfterDecoratorsProcessed()` - Process after all decorators are loaded
     * 3. `onProvideSharedContext()` - Share context with dependent plugins (shareable only)
     * 4. `onConsumeDependencyContexts()` - Consume contexts from dependencies (with dependencies only)
     * 5. `onRegisterMetadata()` - Register metadata in generation context
     * 6. `onGenerateTypes()` - Generate final types
     */
    hooks: {
        /**
         * Initialize custom decorators in the registry.
         * This allows the library to import and process your decorators.
         *
         * @param registry - The decorator registry to register custom decorators
         */
        onInitialize: (registry: ShareableRegistry) => void;

        /**
         * Called after all decorators have been processed.
         * Use this hook to prepare and validate your plugin data.
         */
        onAfterDecoratorsProcessed?: () => void;

        /**
         * Register metadata in the generation context.
         * This is where you can add plugin-specific metadata for code generation.
         *
         * @param context - The generation context to register metadata
         */
        onRegisterMetadata?: (
            context: ShareableContext<
                OverridedGlobalContext['classMetadata'] &
                    ExtractDependenciesOverridedContext<Dependencies>['classMetadata'],
                OverridedGlobalContext['methodMetadata'] &
                    ExtractDependenciesOverridedContext<Dependencies>['methodMetadata']
            >
        ) => void;

        /**
         * Generate types and perform final code generation tasks.
         * This is the final hook in the plugin lifecycle.
         *
         * @param context - The generation context for type generation
         */
        onGenerateTypes?: (metadata: {
            classMetadata: Array<
                ClassMetadata &
                    Partial<
                        OverridedGlobalContext['classMetadata'] &
                            ExtractDependenciesOverridedContext<Dependencies>['classMetadata']
                    >
            >;
            methodMetadata: Array<
                MethodMetadata &
                    Partial<
                        OverridedGlobalContext['methodMetadata'] &
                            ExtractDependenciesOverridedContext<Dependencies>['methodMetadata']
                    >
            >;
        }) => Promise<void>;
    } & ([IsShareable] extends [true]
        ? {
              /**
               * Provide shared context data to dependent plugins.
               * Only called for plugins with `shareable: true`.
               *
               * @returns Shared context that will be passed to dependent plugins
               */
              onProvideSharedContext: () => SharedContext<SharedContextData>;
          }
        : Record<never, never>);

    /** Array of shareable plugins that this plugin depends on */
    dependencies?: Dependencies;
}

/**
 * Utility type to extract the shared context type from a shareable plugin
 */
type ExtractSharedContext<T extends ShareablePlugin> =
    T extends ShareablePlugin<infer _, infer __, infer C>
        ? SharedContext<C>
        : never;

/**
 * Utility type to extract the overrided global context type from a shareable plugin
 */

type ExtractOverridedContext<T extends ShareablePlugin> =
    T extends ShareablePlugin<infer R, infer _, infer __> ? R : never;

/**
 * Apinni Plugin definition with conditional dependency context handling
 */
type InternalApinniPlugin<
    OverridedGlobalContext extends OverridedContext = OverridedContext,
    Dependencies extends Dependency[] = [],
    IsShareable extends boolean = false,
    SharedContext extends [IsShareable] extends [true] ? any : never = [
        IsShareable,
    ] extends [true]
        ? any
        : never,
> = Dependencies extends [Dependency, ...Dependency[]]
    ? BaseApinniPluginProps<
          OverridedGlobalContext,
          Dependencies,
          IsShareable,
          SharedContext
      > & {
          /** Required dependencies that must be shareable plugins */
          dependencies: {
              [K in keyof Dependencies]: Dependencies[K] & Dependency;
          };
          hooks: {
              /**
               * Process shared contexts from dependency plugins.
               * Called after all dependencies have provided their shared contexts.
               *
               * @param contexts - Array of shared contexts from dependency plugins
               */
              onConsumeDependencyContexts: (contexts: {
                  [K in keyof Dependencies]: ExtractSharedContext<
                      Dependencies[K]['plugin']
                  >;
              }) => void;
          };
      }
    : BaseApinniPluginProps<
          OverridedGlobalContext,
          Dependencies,
          IsShareable,
          SharedContext
      >;

export type ApinniPlugin<
    OverridedGlobalContext extends OverridedContext = OverridedContext,
    Dependencies extends Dependency[] = [],
    IsShareable extends boolean = false,
    SharedContext extends [IsShareable] extends [true] ? any : never = [
        IsShareable,
    ] extends [true]
        ? any
        : never,
> = InternalApinniPlugin<
    OverridedGlobalContext,
    Dependencies,
    IsShareable,
    SharedContext
> & {
    readonly __brand?: 'ApinniPlugin';
};
/**
 * Represents a plugin that can be shared as a dependency
 */
export type ShareablePlugin<
    OverridedGlobalContext extends OverridedContext = OverridedContext,
    Dependencies extends Dependency[] = [],
    Context = any,
> = ApinniPlugin<OverridedGlobalContext, Dependencies, true, Context> & {
    readonly __brand?: 'ApinniPlugin';
};

export type PluginTypes =
    | ApinniPlugin<any, any, false, never>
    | ShareablePlugin<any, any, any>;
