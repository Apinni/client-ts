// App.tsx
import { useEffect, useState } from 'react';
import styles from './home-page.module.scss';
import Hero from './Hero';
import QuickStartSection from './QuickStartSection';
import FeaturesSection from './FeaturesSection';
import DecoratorsToTypesSection from './DecoratorsToTypesSection';
import ReadyToGetStarted from './ReadyToGetStarted';

const HomePage = () => {
  return (
    <main className={styles.app}>
      <Hero />
      <QuickStartSection />
      <FeaturesSection />
      <DecoratorsToTypesSection />
      <ReadyToGetStarted />
    </main>
  );
};

export default HomePage;