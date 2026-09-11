import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.locator('#state').textContent().then(text => JSON.parse(text!));
const at = (page: Page, time: number) => page.evaluate(time => window.inputFixture.at(time), time);

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('two pointer taps fire once even at low power; synthetic click never fires', async ({ page, isMobile }) => {
  await at(page, 660);
  const action = page.locator('#action');
  if (isMobile) await action.tap(); else await action.click();
  expect(await state(page)).toMatchObject({ stage: 'AIM', maxRawScore: 570 });
  await action.dispatchEvent('click');
  expect((await state(page)).stage).toBe('AIM');
  await at(page, 1410);
  if (isMobile) await action.tap(); else await action.click();
  const fired = await state(page);
  expect(fired.stage).toBe('FIRE');
  expect(fired.shot.angleDegrees).toBeCloseTo(0);
  await action.click();
  expect((await state(page)).shot).toEqual(fired.shot);
});

test('keyboard repeat and overlapping keys cannot fire; a fast new press can', async ({ page }) => {
  await at(page, 660);
  await page.keyboard.down('Space');
  await page.keyboard.down('Space');
  await page.keyboard.down('Enter');
  await page.keyboard.up('Space');
  expect((await state(page)).stage).toBe('AIM');
  await page.keyboard.up('Enter');
  await page.keyboard.press('Enter');
  expect((await state(page)).stage).toBe('FIRE');
});

test('settings pointer and keyboard events do not confirm a shot', async ({ page }) => {
  await page.locator('#settings').click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  expect((await state(page)).stage).toBe('POWER');
  await page.locator('#action').click();
  await page.locator('#settings').click();
  await page.keyboard.press('Space');
  expect((await state(page)).stage).toBe('AIM');
});

test('secondary touch, release outside and cancel keep the gate correct', async ({ page }) => {
  await page.locator('#settings').evaluate(element => {
    element.addEventListener('pointerup', event => event.stopPropagation());
  });
  const action = page.locator('#action');
  const pointer = (type: string, pointerId: number, isPrimary = true) => action.dispatchEvent(type,
    { pointerId, pointerType: 'touch', isPrimary, button: 0, bubbles: true });
  await pointer('pointerdown', 1);
  await pointer('pointerdown', 2, false);
  await page.locator('#settings').dispatchEvent('pointerup', { pointerId: 1, bubbles: true });
  await pointer('pointerdown', 3);
  expect((await state(page)).stage).toBe('AIM');
  await pointer('pointercancel', 2, false);
  await pointer('pointerup', 3);
  await pointer('pointerdown', 4);
  expect((await state(page)).stage).toBe('FIRE');
});

test('blur freezes the common clock and only explicit resume continues', async ({ page }) => {
  await at(page, 660);
  await page.locator('#action').click();
  await at(page, 910);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await at(page, 6000);
  await page.locator('#action').click();
  expect(await state(page)).toMatchObject({ stage: 'AIM', paused: true, gameTimeMs: 910 });
  await page.locator('#resume').click();
  expect((await state(page)).stage).toBe('AIM');
  await at(page, 6500);
  await page.locator('#action').click();
  expect((await state(page)).shot.angleDegrees).toBeCloseTo(0);
});

test('cleanup removes handlers', async ({ page }) => {
  await page.evaluate(() => { window.inputFixture.dispose(); window.inputFixture.dispose(); });
  await page.locator('#action').click();
  await page.keyboard.press('Space');
  expect((await state(page)).stage).toBe('POWER');
});

test('actual two-press session awards success once, ends on first failure, and retries only the run', async ({ page }) => {
  await at(page, 1100);
  await page.locator('#action').click();
  await at(page, 1850);
  await page.locator('#action').click();
  expect((await state(page)).run).toMatchObject({ status: 'SCENE', totalScore: 0, shot: { score: { rawScore: 1000 } } });
  await page.locator('#finish').click();
  await page.locator('#finish').click();
  expect((await state(page)).run).toMatchObject({ status: 'PLAYING', totalScore: 1000, currentRoundId: 2 });
  await page.locator('#prepare').click();
  await at(page, 2510);
  await page.locator('#action').click();
  await at(page, 3260);
  await page.locator('#action').click();
  expect((await state(page)).run).toMatchObject({ status: 'SCENE', totalScore: 1000, shot: { failureType: 'UNDERPOWER_HIT', score: { rawScore: 570 } } });
  await page.locator('#retry').click();
  expect((await state(page)).run.status).toBe('SCENE');
  await page.locator('#finish').click();
  expect((await state(page)).run).toMatchObject({ status: 'GAME_OVER', totalScore: 1000 });
  await page.locator('#retry').click();
  await page.locator('#retry').click();
  expect((await state(page)).run).toMatchObject({ status: 'PLAYING', runId: 2, totalScore: 0, currentRoundId: 3 });
});
