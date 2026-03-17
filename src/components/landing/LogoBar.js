import styles from './LogoBar.module.css';

const LOGOS = [
  { name: 'Meta',      abbr: 'M'  },
  { name: 'Instagram', abbr: 'IG' },
  { name: 'Facebook',  abbr: 'FB' },
  { name: 'Creator+',  abbr: 'C+' },
  { name: 'Business',  abbr: 'Biz'},
];

export default function LogoBar() {
  return (
    <section className={styles.bar}>
      <div className={styles.inner}>
        <span className={styles.label}>Trusted &amp; verified by</span>
        <div className={styles.logos}>
          {LOGOS.map(({ name, abbr }) => (
            <div key={name} className={styles.logo}>
              <div className={styles.logoIcon}>{abbr}</div>
              <span className={styles.logoName}>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
