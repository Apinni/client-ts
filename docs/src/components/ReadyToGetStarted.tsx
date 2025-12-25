// components/DecoratorsToTypesSection.tsx
import styles from './home-page.module.scss';
import CodeBlock from '@theme/CodeBlock';
import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'
import Link from '@docusaurus/Link';
import {  FileText, Github } from 'lucide-react';

const ReadyToGetStarted = () => (
  <section className={`${styles.section} ${styles['section--ready-to-get-started']}`}>
    <div className={`${styles['hero__container']} ${styles['hero__container--small']}`}>
      <div className={styles['section__header']}>
        <h2 className={styles['section__title']}>Ready to Get Started?</h2>
      </div>
      <div className={styles['code-wrapper']}>
        <Tabs groupId="package-manager">
            <TabItem value="npm" label="npm" default>
                <CodeBlock language='bash' title="Terminal">
                {`$ npm install @apinni/client-ts --save-dev
$ npm run apinni`}
                </CodeBlock>
            </TabItem>
            <TabItem value="yarn" label="Yarn">
                <CodeBlock language='bash' title="Terminal">
                {`$ yarn add -D @apinni/client-ts
$ yarn apinni`}
                </CodeBlock>
            </TabItem>
            <TabItem value="pnpm" label="pnpm">
                                <CodeBlock language='bash' title="Terminal">
                {`$ pnpm add -D @apinni/client-ts
$ pnpm run apinni`}
                </CodeBlock>
            </TabItem>
            </Tabs>
        
      </div>
       <p className={styles['section__note']}>
          Enable decorators in your tsconfig.json and run Apinni to generate clean .d.ts files from your decorated controllers.
        </p>
        <div className={styles['button-wrapper']}>
        <Link href='/docs/introduction' className={styles['link']}>
          <button className={styles['get-started-button']} type="button">
            <FileText size={20} />
            View documentation
          </button>
        </Link>
        <Link href='https://github.com/Apinni/client-ts' className={styles['link']}>
          <button className={styles['go-to-github-button']} type="button">
            <Github size={20} />
            Go to Github
          </button>
        </Link>
      </div>
    </div>
  </section>
);

export default ReadyToGetStarted;