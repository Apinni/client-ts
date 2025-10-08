import Layout from '@theme/Layout';
import type { ReactNode } from 'react';

import HomePage from '../components/HomePage';

export default function Home(): ReactNode {
    return (
        <Layout
            title="Welcome to Apinni"
            description="Apinni: A TypeScript library for generating type-safe API definitions using decorators."
        >
            <HomePage />
        </Layout>
    );
}