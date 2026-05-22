const puppeteer = require('puppeteer-core');

async function submitPin(pin) {
  if (!pin || !/^\d{6}$/.test(pin)) {
    console.error('Invalid PIN — must be 6 digits.');
    process.exit(1);
  }

  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });

    const pages = await browser.pages();

    // Find the payroll page (any overmind payroll URL)
    let payrollPage = pages.find(p => p.url().includes('overmind-dashboard.vercel.app/restaurant/payroll'));

    if (!payrollPage) {
      console.error('Payroll page not found. Open tabs:');
      for (const p of pages) console.error(' -', p.url());
      process.exit(1);
    }

    console.log('Found:', payrollPage.url());
    await payrollPage.bringToFront();

    // Fill the visible input and dispatch the custom event
    await payrollPage.evaluate((pin) => {
      const input = Array.from(document.querySelectorAll('input')).find(i =>
        !['email', 'password'].includes(i.type)
      );
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, pin);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      window.dispatchEvent(new CustomEvent('overmind:payroll:input', {
        detail: { key: 'mfa', value: pin }
      }));
    }, pin);

    console.log(`PIN submitted: ${pin}`);
    await browser.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

submitPin(process.argv[2]);
