import './style.css';

const toast = document.querySelector('.toast');
const detailWatch = document.querySelector('.detail-product .product-watch');
const detailKicker = document.querySelector('.detail-copy .section-kicker');
const detailTitle = document.querySelector('.detail-copy h2');
const detailText = document.querySelector('.detail-copy p');
const detailPrice = document.querySelector('.detail-copy .primary-button');
const detailImage = document.querySelector('#detail-watch-image');
let selectedProduct = { name: 'جرين', color: 'أخضر', image: detailImage?.src || '' };

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 3600);
}

document.querySelectorAll('[data-scroll]').forEach((button) => {
  button.addEventListener('click', () => document.querySelector(button.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' }));
});

document.querySelectorAll('.select-product').forEach((button) => {
  button.addEventListener('click', () => {
    const card = button.closest('.product-card');
    const product = card.dataset.product;
    selectedProduct = { name: product, color: card.dataset.color, image: card.dataset.image };
    detailWatch.className = `product-watch has-render large ${card.dataset.tone}`;
    detailImage.src = card.dataset.image;
    detailImage.alt = `ساعة الأهلي ${product} الذكية بشاشة تحمل شعار البنك الأهلي المصري`;
    detailKicker.textContent = `ساعة الأهلي ${product}`;
    detailTitle.innerHTML = `إطلالة ${product === 'روز' ? 'ناعمة' : 'جريئة'}<br /><span>بروح الأهلي</span>`;
    detailText.textContent = `ساعة ذكية أنيقة باللون ${card.dataset.color} المميز، حزام مريح وتصميم عملي، تجمع بين الأداء اليومي والهوية المصرفية للبنك الأهلي.`;
    detailPrice.innerHTML = `${card.dataset.price === 'هدية حصرية' ? 'احصل على هذه الساعة مجانًا' : 'اطلب هذه الساعة الآن'} <span>←</span>`;
    document.querySelector('#details')?.scrollIntoView({ behavior: 'smooth' });
    showToast(`تم اختيار ساعة الأهلي ${product}`);
  });
});

document.querySelector('#registration-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const values = Object.fromEntries(new FormData(form).entries());
  const submitButton = form.querySelector('.submit-button');
  submitButton.disabled = true;
  submitButton.textContent = 'جارٍ حفظ الطلب...';
  try {
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, watchName: selectedProduct.name, watchColor: selectedProduct.color }) });
    if (!response.ok) throw new Error('order_failed');
    showToast('تم استلام طلبك بنجاح — سنتواصل معك قريبًا.');
    form.reset();
  } catch {
    showToast('تعذر حفظ الطلب حاليًا. حاول مرة أخرى.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'متابعة التسجيل';
  }
});
