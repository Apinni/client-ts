// components/FeaturesSection.tsx
import { Code, Zap, Shield, Layers } from 'lucide-react';
import styles from './home-page.module.scss';

const features = [
  {
    icon: <Code />,
    title: 'Pure Type Generation',
    description: 'Generate only types files with API schemas from @Apinni decorators.',
    color: 'icon--blue',
  },
  {
    icon: <Zap />,
    title: 'No Bundle Exposure',
    description: 'Types stay in .d.ts files, never bundled. Prevents API endpoint leaks in client builds.',
    color: 'icon--yellow',
  },
  {
    icon: <Shield />,
    title: 'Proxy API Support',
    description: 'Utilities to define ProxyApi schemas for proxy layers like Next.js.',
    color: 'icon--green',
  },
  {
    icon: <Layers />,
    title: 'Plugin Architecture',
    description: 'Extensible plugin system to customize type generation and add framework-specific utilities.',
    color: 'icon--purple',
  },
];

const FeaturesSection = () => (
  <section className={`${styles.section} ${styles['section--features']}`}>
    <div className={styles['hero__container']}>
      <div className={styles['section__header']}>
        <h2 className={styles['section__title']}>Pure Type Generation Philosophy</h2>
        <p className={styles['section__description']}>
          Generate clean .d.ts files without runtime logic or bundle exposure.
        </p>
      </div>
      <div className={styles['section__grid']}>
        {features.map((feature, index) => (
          <article key={index} className={styles['feature-card']}>
            <div className={`${styles['feature-card__icon-wrapper']} ${styles[feature.color]}`}>
              {feature.icon}
            </div>
            <h3 className={styles['feature-card__title']}>{feature.title}</h3>
            <p className={styles['feature-card__description']}>{feature.description}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;