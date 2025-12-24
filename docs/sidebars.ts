import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
    sidebar: [
        {
            type: 'doc',
            id: 'introduction',
            label: 'Introduction',
        },
        {
            type: 'doc',
            id: 'getting-started-v2',
            label: 'Getting Started',
        },
        {
            type: 'category',
            label: 'Core Concepts',
            collapsed: false,
            items: [
                'decorators/apinni-controller',
                'decorators/apinni-endpoint',
                'decorators/apinni-domain',
                'decorators/apinni-disabled',
            ],
        },
        {
            type: 'category',
            label: 'Type System',
            collapsed: false,
            items: [
                'utility-types',
                'proxy',
            ],
        },
        {
            type: 'doc',
            id: 'cli',
            label: 'CLI Reference',
        },
        {
            type: 'category',
            label: 'Guides',
            collapsed: false,
            items: [
                'guides/backend-integration',
                'guides/frontend-integration',
                'guides/best-practices',
            ],
        },
        {
            type: 'category',
            label: 'Plugins',
            items: [
                'plugins/overview',
                'plugins/creating-plugins',
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
