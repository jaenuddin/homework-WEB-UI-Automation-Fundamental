const assert = require('node:assert/strict');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const BASE_URL = process.env.BASE_URL || 'https://belajar-bareng.onrender.com';
const USER = process.env.ADMIN_USERNAME || 'admin';
const PASS = process.env.ADMIN_PASSWORD || 'admin';

async function login(driver) {
  await driver.get(BASE_URL);
  await driver.wait(until.elementLocated(By.css('[data-testid="username-input"]')), 15000);
  await driver.findElement(By.css('[data-testid="username-input"]')).sendKeys(USER);
  await driver.findElement(By.css('[data-testid="password-input"]')).sendKeys(PASS);
  await driver.findElement(By.css('[data-testid="login-button"]')).click();
  await driver.wait(until.urlContains('/users'), 15000);
}

async function cleanup(driver, username) {
  return driver.executeAsyncScript((name, done) => {
    const token = localStorage.getItem('token');
    fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const user = (data.users || []).find((item) => item.username === name);
        if (!user) return done(true);
        return fetch(`/api/delete-user/${user.userId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }).then((r) => done(r.ok));
      })
      .catch(() => done(false));
  }, username);
}

describe('Login dan Add User', function () {
   this.timeout(60000);
   
  let driver;

  beforeEach(async function () {
    const options = new chrome.Options().addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage');
    if (process.env.CHROME_BIN) options.setChromeBinaryPath(process.env.CHROME_BIN);
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  });

  afterEach(async function () {
    if (driver) await driver.quit();
  });

  it('login berhasil', async function () {
    await login(driver);
    assert.match(await driver.getCurrentUrl(), /\/users$/);
    assert.equal(await driver.findElement(By.css('h2')).getText(), 'List Users');
  });

  it('add user berhasil', async function () {
    const stamp = Date.now().toString(26).toUpperCase().replace(/\d/g, (d) => String.fromCharCode(81 + Number(d)));
    const name = `Q${stamp}`.slice(0, 10);
    await login(driver);
    await driver.get(`${BASE_URL}/add`);
    await driver.wait(until.elementLocated(By.css('[data-testid="submit-button"]')), 15000);
    await driver.findElement(By.css('[data-testid="username-input"]')).sendKeys(name);
    await driver.findElement(By.css('[data-testid="age-input"]')).sendKeys('31');
    await driver.findElement(By.css('[data-testid="submit-button"]')).click();

    try {
      await driver.wait(until.elementLocated(By.css('.toast-success, .Toastify__toast--success')), 15000);
      await driver.get(`${BASE_URL}/users`);
      await driver.wait(async () => (await driver.findElement(By.tagName('body')).getText()).includes(name), 15000);
      assert.ok((await driver.findElement(By.tagName('body')).getText()).includes(name));
    } finally {
      assert.equal(await cleanup(driver, name), true, 'fixture test harus berhasil dibersihkan');
    }
  });
});
