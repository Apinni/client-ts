import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
    title: 'Apinni',
    tagline: 'Generate TypeScript API types with decorators',
    favicon: 'img/logo-short.svg',

    // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
    future: {
        v4: true, // Improve compatibility with the upcoming Docusaurus v4
    },

    markdown: {
        mermaid: true,
    },

    themes: ['@docusaurus/theme-mermaid'],

    // Set the production url of your site here
    url: 'https://apinni.github.io',
    // Set the /<baseUrl>/ pathname under which your site is served
    // For GitHub pages deployment, it is often '/<projectName>/'
    baseUrl: '/client-ts/',

    // GitHub pages deployment config.
    // If you aren't using GitHub pages, you don't need these.
    organizationName: 'Apinni', // Usually your GitHub org/user name.
    projectName: 'client-ts', // Usually your repo name.

    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',

    plugins: ['@docusaurus/theme-live-codeblock', 'docusaurus-plugin-sass'],

    // Even if you don't use internationalization, you can use this field to set
    // useful metadata like html lang. For example, if your site is Chinese, you
    // may want to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },

    presets: [
        [
            'classic',
            {
                docs: {
                    sidebarPath: './sidebars.ts',
                },
                theme: {
                    customCss: './src/css/custom.scss',
                },
            } satisfies Preset.Options,
        ],
    ],

    themeConfig: {
        // Replace with your project's social card
        image: 'img/apinni-social-card.svg',
        navbar: {
            logo: {
                alt: 'Apinni Logo',
                src: 'img/logo-new.svg',
                srcDark: 'img/logo-new-dark.svg',
            },
            items: [
                {
                    href: '/docs/introduction',
                    label: "Docs",
                    position: 'left',
                },
                {
                    href: 'https://github.com/Apinni/client-ts',
                    label: 'GitHub',
                    position: 'right',
                },
            ],
        },
        footer: {
            style: 'dark',
            links: [
                {
                    title: 'Docs',
                    items: [
                        { label: 'Introduction', to: '/docs/introduction' },
                        { label: 'Decorators', to: '/docs/decorators/apinni-controller' },
                        { label: 'Plugins', to: '/docs/plugins' },
                    ],
                },
                {
                    title: 'Community',
                    items: [
                        
                        {
                            label: 'GitHub Discussions',
                            href: 'https://github.com/Apinni/client-ts/discussions',
                        },
                    ],
                },
            ],
            copyright: `Copyright © ${new Date().getFullYear()} Apinni. Built with Docusaurus.`,
        },
        prism: {
            theme: prismThemes.vsLight,
            darkTheme: prismThemes.vsDark,
            additionalLanguages: ['bash', 'typescript']
        },
        liveCodeBlock: {
            /**
             * The position of the live playground, above or under the editor
             * Possible values: "top" | "bottom"
             */
            playgroundPosition: 'bottom',
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
