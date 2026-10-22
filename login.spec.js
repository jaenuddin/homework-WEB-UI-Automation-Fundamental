const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.BASE_URL || 'https://belajar-bareng.onrender.com/';
const USERNAME = process.env.TEST_USERNAME || 'admin';
const PASSWORD = process.env.TEST_PASSWORD || 'admin';
const INVALID_USERNAME = process.env.INVALID_USERNAME || 'user_tidak_terdaftar';
const INVALID_PASSWORD = process.env.INVALID_PASSWORD || 'password_salah';
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');

let driver;

// Mocha hooks: suite setup/teardown and per-test browser lifecycle.
before(function () {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

beforeEach(async function () {
  this.timeout(10000);

  const options = new chrome.Options();
  if (process.env.HEADLESS !== 'false') {
    options.addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,1000');
  }
  if (process.env.CHROME_BIN) options.setChromeBinaryPath(process.env.CHROME_BIN);

  driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: 30000, script: 10000 });
  await driver.get(BASE_URL);
  await driver.wait(until.elementLocated(By.css('[data-testid="username-input"]')), 15000);
});

afterEach(async function () {
  try {
    if (this.currentTest?.state === 'failed' && driver) {
      const safeTitle = this.currentTest.title.replace(/[^a-z0-9_-]/gi, '_');
      const screenshot = await driver.takeScreenshot();
      fs.writeFileSync(path.join(SCREENSHOT_DIR, `${safeTitle}.png`), screenshot, 'base64');
    }
  } finally {
    if (driver) {
      await driver.quit();
      driver = undefined;
    }
  }
});

after(function () {
  // Reports and failure screenshots are retained for review after the test run.
});

async function submitLogin(username, password) {
  const usernameInput = await driver.findElement(By.css('[data-testid="username-input"]'));
  const passwordInput = await driver.findElement(By.css('[data-testid="password-input"]'));
  await usernameInput.clear();
  await usernameInput.sendKeys(username);
  await passwordInput.clear();
  await passwordInput.sendKeys(password);
  await driver.findElement(By.css('[data-testid="login-button"]')).click();
}

describe('Login page', function () {
  this.timeout(10000);

  it('menampilkan form login dan kontrol utama', async function () {
    const title = await driver.getTitle();
    const username = await driver.findElement(By.css('[data-testid="username-input"]'));
    const password = await driver.findElement(By.css('[data-testid="password-input"]'));
    const submit = await driver.findElement(By.css('[data-testid="login-button"]'));

    if (!title.includes('User Management')) throw new Error(`Judul halaman tidak sesuai: ${title}`);
    if (!(await username.isDisplayed()) || !(await password.isDisplayed()) || !(await submit.isDisplayed())) {
      throw new Error('Form login tidak tampil lengkap');
    }
  });

  it('menampilkan petunjuk kredensial demo saat Show Hint diklik', async function () {
    await driver.findElement(By.css('[data-testid="hint-button"]')).click();
    await driver.wait(until.elementLocated(By.id('hintUser')), 3000);
    const hint = await driver.findElement(By.css('.hint')).getText();
    if (!hint.includes('Username: admin') || !hint.includes('Password: admin')) {
      throw new Error(`Petunjuk demo tidak sesuai: ${hint}`);
    }
  });

  it('menolak submit saat username dan password kosong (validasi browser)', async function () {
    const submit = await driver.findElement(By.css('[data-testid="login-button"]'));
    await submit.click();
    const username = await driver.findElement(By.css('[data-testid="username-input"]'));
    const password = await driver.findElement(By.css('[data-testid="password-input"]'));
    const usernameValid = await driver.executeScript('return arguments[0].validity.valid', username);
    const passwordValid = await driver.executeScript('return arguments[0].validity.valid', password);
    if (usernameValid || passwordValid) throw new Error('Form seharusnya menolak field wajib yang kosong');
    if (!((await driver.getCurrentUrl()).includes('/'))) throw new Error('URL berubah setelah submit kosong');
  });

  it('menolak kredensial yang salah dan tetap berada di halaman login', async function () {
    await submitLogin(INVALID_USERNAME, INVALID_PASSWORD);
    const toast = By.css('.Toastify__toast--error .Toastify__toast-body');
    await driver.wait(async () => {
      const elements = await driver.findElements(toast);
      return elements.length > 0 && (await elements[0].getText()).trim().length > 0;
    }, 15000);
    const toastText = await driver.findElement(toast).getText();
    if (!toastText.trim()) throw new Error('Pesan error login kosong');
    if (!new URL(await driver.getCurrentUrl()).pathname.endsWith('/')) {
      throw new Error(`Login gagal tetapi berpindah ke ${await driver.getCurrentUrl()}`);
    }
  });

  it('berhasil login dengan kredensial demo admin/admin', async function () {
    await submitLogin(USERNAME, PASSWORD);
    await driver.wait(async () => {
      const pathname = new URL(await driver.getCurrentUrl()).pathname;
      return pathname === '/users' || pathname === '/users/';
    }, 15000);
    const token = await driver.executeScript('return localStorage.getItem("token")');
    if (!token) throw new Error('Login berhasil tanpa token tersimpan di localStorage');
    if (!new URL(await driver.getCurrentUrl()).pathname.startsWith('/users')) {
      throw new Error('Tidak diarahkan ke halaman users setelah login');
    }
  });
});
