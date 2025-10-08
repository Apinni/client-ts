// components/QuickStartSection.tsx
import { Package, Wrench, Code, Terminal } from 'lucide-react';
import styles from './home-page.module.scss';

const quickStart = [
  {
    icon: <Package className={styles.featureIcon} />,
    title: 'Install',
    description: 'Install apinni with favourite package manager',
    step: '1',
  },
  {
    icon: <Wrench className={styles.featureIcon} />,
    title: 'Configure',
    description: 'Enable decorators in tsconfig.json',
    step: '2',
  },
  {
    icon: <Code className={styles.featureIcon} />,
    title: 'Decorate',
    description: 'Add @Apinni decorators to your classes and methods',
    step: '3',
  },
  {
    icon: <Terminal className={styles.featureIcon} />,
    title: 'Generate',
    description: 'Run apinni CLI command',
    step: '4',
  },
];

const QuickStartSection = () => (
  <section className={`${styles.section} ${styles['section--quick-start']}`}>
    <div className={styles['hero__container']}>
      <div className={styles['section__header']}>
        <h2 className={styles['section__title']}>Quick Start</h2>
        <p className={styles['section__description']}>
          Get up and running with Apinni in just 4 simple steps.
        </p>
      </div>
      <div className={styles['section__grid']}>
        {quickStart.map((step, index) => (
          <article key={index} className={styles['step-card']}>
            <div className={styles['step-card__header']}>
              <div className={styles['step-card__number']}>{step.step}</div>
              <div className={styles['step-card__icon-wrapper']}>{step.icon}</div>
            </div>
            <h3 className={styles['step-card__title']}>{step.title}</h3>
            <p className={styles['step-card__description']}>{step.description}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default QuickStartSection;