import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
    sidebar: [
        'introduction',
        'getting-started',
        {
            type: 'category',
            label: 'Decorators',
            items: [
                'decorators/apinni-controller',
                'decorators/apinni-endpoint',
                'decorators/apinni-domain',
                'decorators/apinni-disabled',
            ],
        },
        'cli',
        {
            type: 'category',
            label: 'Plugins',
            items: [
                'plugins/overview',
                'plugins/creating-plugins',
            ],
        },
        'utility-types',
        'proxy',
        {
            type: 'category',
            label: 'Guides',
            items: [
                'guides/backend-integration',
                'guides/frontend-integration',
                'guides/best-practices',
            ],
        },
        {
            type: 'category',
            label: 'API Reference',
            items: [
                'api-reference/overview'
            ],
        },
    ],
};

export default sidebars;
