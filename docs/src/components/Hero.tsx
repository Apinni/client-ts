// components/Hero.tsx
import { ArrowRight, BookOpen, CheckCircle, Github, Rocket, Star, Zap } from 'lucide-react';
import styles from './home-page.module.scss';

import Link from '@docusaurus/Link'
import Tag from '@theme/Tag';
import useBaseUrl from '@docusaurus/useBaseUrl';


const Hero = () => {
  const logoLightUrl = useBaseUrl('/img/logo-new.svg');
  const logoDarkUrl = useBaseUrl('/img/logo-new-dark.svg');

  return (
    <header className={styles.hero}>
      <div className={styles.overlay} />
      <div className={styles['hero__content']}>
        <div className={styles['hero__container']}>
          <div className={styles.logo}>
            <img
              className={styles['logo-light']}
              src={logoLightUrl}
              alt="Apinni Logo"
              width={320}
              height={100}
            />
            <img
              className={styles['logo-dark']}
              src={logoDarkUrl}
              alt="Apinni Logo"
              width={320}
              height={100}
            />
          </div>
          <h1 className={styles['hero__title']}>
            TypeScript Types
            <br />
            <span className={styles['title-gradient']}>Generated Automatically</span>
          </h1>
          <p className={styles['hero__description']}>
            Apinni generates clean .d.ts files with API schemas and utilities from your backend decorators. Zero runtime overhead, no bundle exposure, with plugin support and proxy API capabilities.
          </p>
        </div>
        <div className={styles['button-wrapper']}>
          <Link href='/docs/introduction' className={styles['link']}>
            <button className={styles['get-started-button']} type="button">
              <BookOpen size={20} />
              Get Started
              <ArrowRight size={20} />
            </button>
          </Link>
          <Link href='https://github.com/Apinni/client-ts' className={styles['link']}>
            <button className={styles['view-on-github-button']} type="button">
              <Github size={20} />
              View on GitHub
            </button>
          </Link>
        </div>
        <div className={styles['points-wrapper']}>
          <div className={styles['point-item']}>
            {/* <Rocket size={16} color="white" fill="grey" /> */}
            <span>🚀</span>
            <span className={styles['point-text']}>Just Launched</span>
          </div>
          <div className={styles['point-item']}>
            <CheckCircle size={16} color="#10B981" />
            <span className={styles['point-text']}>TypeScript 5.0+ support</span>
          </div>
          <div className={styles['point-item']}>
            <Zap size={16} color="rgb(59 130 246)" />
            <span className={styles['point-text']}>Zero runtime overhead</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Hero;